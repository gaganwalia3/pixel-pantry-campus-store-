
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const HEX_ID_PATTERN = /^[0-9a-f]{32}$/;
const MAX_REVIEW_TEXT_LENGTH = 2000;

const reviewRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) =>
        req.user?.id || ipKeyGenerator(req.ip),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many review requests. Please try again later.',
    },
});

function isValidHexId(value) {
    return (
        typeof value === 'string' &&
        HEX_ID_PATTERN.test(value)
    );
}

function normalizeReviewText(value) {
    if (value === undefined || value === null) {
        return {
            valid: true,
            value: null,
        };
    }

    if (typeof value !== 'string') {
        return {
            valid: false,
            value: null,
        };
    }

    const text = value.trim();

    if (text.length > MAX_REVIEW_TEXT_LENGTH) {
        return {
            valid: false,
            value: null,
        };
    }

    return {
        valid: true,
        value: text || null,
    };
}

function isValidRating(value) {
    return (
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 5
    );
}

/*
 * GET /api/products/:productId/reviews
 *
 * Public endpoint.
 *
 * Returns the product's average rating, review count,
 * and latest reviews.
 */
router.get('/:productId/reviews', async (req, res) => {
    const { productId } = req.params;

    if (!isValidHexId(productId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid product ID.',
        });
    }

    try {
        const [products] = await db.execute(
            `
            SELECT id
            FROM products
            WHERE id = UNHEX(?)
              AND status = 'ACTIVE'
            LIMIT 1
            `,
            [productId],
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found.',
            });
        }

        const [summaryRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS review_count,
                COALESCE(AVG(rating), 0) AS average_rating
            FROM product_reviews
            WHERE product_id = UNHEX(?)
            `,
            [productId],
        );

        const [reviewRows] = await db.execute(
            `
            SELECT
                HEX(r.id) AS id,
                r.rating,
                r.review_text,
                r.created_at,
                r.updated_at,
                u.name AS reviewer_name
            FROM product_reviews r
            INNER JOIN users u
                ON u.id = r.user_id
            WHERE r.product_id = UNHEX(?)
            ORDER BY
                r.created_at DESC,
                r.id DESC
            LIMIT 100
            `,
            [productId],
        );

        return res.json({
            success: true,
            summary: {
                averageRating: Number(
                    Number(
                        summaryRows[0].average_rating,
                    ).toFixed(2),
                ),
                reviewCount: Number(
                    summaryRows[0].review_count,
                ),
            },
            reviews: reviewRows.map((review) => ({
                id: review.id.toLowerCase(),
                rating: review.rating,
                reviewText: review.review_text,
                reviewerName: review.reviewer_name,
                createdAt: review.created_at,
                updatedAt: review.updated_at,
                verifiedPurchase: true,
            })),
        });
    } catch (error) {
        console.error(
            'Product reviews fetch failed:',
            error,
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to load product reviews.',
        });
    }
});

/*
 * GET /api/products/reviews/eligibility
 *
 * Authenticated endpoint.
 *
 * Returns delivered items belonging to the authenticated
 * user and whether the seven-day review window is open.
 */
router.get(
    '/reviews/eligibility',
    requireAuth,
    async (req, res) => {
        if (req.user.role === 'ADMIN') {
            return res.status(403).json({
                success: false,
                message:
                    'This account cannot submit customer reviews.',
            });
        }

        try {
            const [rows] = await db.execute(
                `
                SELECT
                    HEX(oi.id) AS order_item_id,
                    HEX(oi.product_id) AS product_id,
                    oi.product_name,
                    oi.delivered_at,

                    EXISTS (
                        SELECT 1
                        FROM product_reviews existing_review
                        WHERE existing_review.user_id = o.user_id
                          AND existing_review.product_id = oi.product_id
                    ) AS already_reviewed,

                    CASE
                        WHEN oi.delivered_at >
                            DATE_SUB(
                                CURRENT_TIMESTAMP(6),
                                INTERVAL 7 DAY
                            )
                        THEN 1
                        ELSE 0
                    END AS within_window

                FROM order_items oi

                INNER JOIN orders o
                    ON o.id = oi.order_id

                WHERE o.user_id = UNHEX(?)
                  AND oi.fulfillment_status = 'DELIVERED'
                  AND oi.delivered_at IS NOT NULL

                ORDER BY
                    oi.delivered_at DESC,
                    oi.id DESC
                `,
                [req.user.id],
            );

            return res.json({
                success: true,
                items: rows.map((item) => {
                    const alreadyReviewed =
                        Boolean(item.already_reviewed);

                    const withinWindow =
                        Boolean(item.within_window);

                    return {
                        orderItemId:
                            item.order_item_id.toLowerCase(),
                        productId:
                            item.product_id.toLowerCase(),
                        productName: item.product_name,
                        deliveredAt: item.delivered_at,
                        alreadyReviewed,
                        withinWindow,
                        canReview:
                            !alreadyReviewed &&
                            withinWindow,
                    };
                }),
            });
        } catch (error) {
            console.error(
                'Review eligibility lookup failed:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to check review eligibility.',
            });
        }
    },
);

/*
 * POST /api/products/reviews
 *
 * Authenticated endpoint.
 *
 * JSON body:
 * {
 *   "orderItemId": "32-character-hex-id",
 *   "rating": 5,
 *   "reviewText": "Great product!"
 * }
 *
 * The server determines the customer, product, delivery
 * timestamp, and eligibility. Those values are never
 * accepted from the request body.
 */
router.post(
    '/reviews',
    requireAuth,
    reviewRateLimiter,
    async (req, res) => {
        if (req.user.role === 'ADMIN') {
            return res.status(403).json({
                success: false,
                message:
                    'This account cannot submit customer reviews.',
            });
        }

        const {
            orderItemId,
            rating,
            reviewText,
        } = req.body || {};

        if (!isValidHexId(orderItemId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order item ID.',
            });
        }

        if (!isValidRating(rating)) {
            return res.status(400).json({
                success: false,
                message:
                    'Rating must be an integer from 1 to 5.',
            });
        }

        const normalizedText =
            normalizeReviewText(reviewText);

        if (!normalizedText.valid) {
            return res.status(400).json({
                success: false,
                message:
                    'Review text must be 2000 characters or fewer.',
            });
        }

        /*
         * Require at least a rating and either text or
         * a rating-only review. Rating-only reviews are
         * intentionally allowed.
         */
        let connection;

        try {
            connection = await db.getConnection();

            await connection.beginTransaction();

            /*
             * Lock the order first, then the exact item.
             * This serializes concurrent review attempts
             * for the same order item.
             */
            const [orderRows] = await connection.execute(
                `
                SELECT
                    o.id,
                    o.user_id
                FROM orders o
                INNER JOIN order_items oi
                    ON oi.order_id = o.id
                WHERE oi.id = UNHEX(?)
                  AND o.user_id = UNHEX(?)
                LIMIT 1
                FOR UPDATE
                `,
                [
                    orderItemId,
                    req.user.id,
                ],
            );

            if (orderRows.length === 0) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Eligible delivered order item not found.',
                });
            }

            const [itemRows] = await connection.execute(
                `
                SELECT
                    id,
                    product_id,
                    fulfillment_status,
                    delivered_at
                FROM order_items
                WHERE id = UNHEX(?)
                  AND order_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    orderItemId,
                    orderRows[0].id,
                ],
            );

            if (itemRows.length === 0) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Eligible delivered order item not found.',
                });
            }

            const item = itemRows[0];

            if (
                item.fulfillment_status !== 'DELIVERED' ||
                !item.delivered_at
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Only delivered items can be reviewed.',
                });
            }

            /*
             * Compare against database time to avoid trusting
             * the customer's clock or supplied timestamps.
             */
            const [deadlineRows] = await connection.execute(
                `
                SELECT
                    (
                        ? > DATE_SUB(
                            CURRENT_TIMESTAMP(6),
                            INTERVAL 7 DAY
                        )
                    ) AS within_window
                `,
                [item.delivered_at],
            );

            if (!Boolean(deadlineRows[0].within_window)) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'The seven-day review window has expired.',
                });
            }

            /*
             * The schema enforces one review per customer
             * per product and one review per order item.
             * This check provides a clearer response;
             * unique indexes remain the final safeguard.
             */
            const [existingReviews] = await connection.execute(
                `
                SELECT id
                FROM product_reviews
                WHERE user_id = UNHEX(?)
                  AND product_id = ?
                LIMIT 1
                `,
                [
                    req.user.id,
                    item.product_id,
                ],
            );

            if (existingReviews.length > 0) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'You have already reviewed this product.',
                });
            }

            const reviewId = Buffer.from(
                require('crypto')
                    .randomUUID()
                    .replace(/-/g, ''),
                'hex',
            );

            await connection.execute(
                `
                INSERT INTO product_reviews (
                    id,
                    product_id,
                    user_id,
                    order_item_id,
                    rating,
                    review_text
                )
                VALUES (?, ?, UNHEX(?), ?, ?, ?)
                `,
                [
                    reviewId,
                    item.product_id,
                    req.user.id,
                    item.id,
                    rating,
                    normalizedText.value,
                ],
            );

            await connection.commit();

            return res.status(201).json({
                success: true,
                message: 'Review submitted successfully.',
                review: {
                    id: reviewId.toString('hex'),
                    productId:
                        item.product_id.toString('hex'),
                    rating,
                    reviewText: normalizedText.value,
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        'Review transaction rollback failed:',
                        rollbackError,
                    );
                }
            }

            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message:
                        'You have already reviewed this product.',
                });
            }

            console.error(
                'Review submission failed:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to submit review.',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);

module.exports = router;
