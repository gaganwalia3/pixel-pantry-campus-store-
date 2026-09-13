const express = require('express');
const crypto = require('crypto');

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DELIVERY_LOCATION =
    'Square One, Chitkara University';

const PAYMENT_METHOD = 'COD';

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

function isValidUuid(value) {
    return (
        typeof value === 'string' &&
        /^[0-9a-fA-F]{32}$/.test(
            value,
        )
    );
}

function normalizePhone(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const phone = value.trim();

    if (
        !/^\+?[0-9][0-9\s-]{7,19}$/.test(
            phone,
        )
    ) {
        return null;
    }

    return phone;
}

function decimalToNumber(value) {
    return Number(value);
}

/*
 * ============================================================
 * CHECKOUT IDEMPOTENCY
 * ============================================================
 *
 * Every checkout request must provide an Idempotency-Key.
 *
 * The key is scoped to the authenticated user and paired
 * with a SHA-256 fingerprint of the normalized checkout
 * request.
 *
 * Same key + same request:
 *      return the original order.
 *
 * Same key + different request:
 *      reject with 409.
 *
 * This prevents accidental duplicate orders caused by:
 *
 * - double-clicks
 * - network retries
 * - frontend retries
 * - browser refreshes
 * - lost responses
 */
function getIdempotencyKey(req) {
    const value =
        req.get('Idempotency-Key');

    if (
        typeof value !== 'string' ||
        value.length === 0
    ) {
        return null;
    }

    const key = value.trim();

    if (
        key.length === 0 ||
        key.length >
        IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
        return null;
    }

    /*
     * Restrict the key to printable ASCII.
     *
     * This avoids control characters and unexpected
     * header values being persisted.
     */
    if (!/^[\x21-\x7E]+$/.test(key)) {
        return null;
    }

    return key;
}

function createRequestFingerprint({
    customerName,
    customerPhone,
    items,
}) {
    const canonicalItems =
        items
            .map((item) => ({
                productId:
                    item.productId,
                quantity:
                    item.quantity,
            }))
            .sort((a, b) =>
                a.productId.localeCompare(
                    b.productId,
                ),
            );

    const canonicalPayload =
        JSON.stringify({
            customerName,
            customerPhone,
            items: canonicalItems,
        });

    return crypto
        .createHash('sha256')
        .update(
            canonicalPayload,
            'utf8',
        )
        .digest('hex');
}

/*
 * ============================================================
 * LOAD EXISTING IDEMPOTENT ORDER
 * ============================================================
 *
 * Used when a client retries a request with a key that has
 * already successfully created an order.
 */
async function getExistingOrder(
    userId,
    orderId,
) {
    const [
        orderRows,
    ] = await db.query(
        `
        SELECT
            HEX(id) AS id,
            status,
            subtotal,
            total_amount,
            currency,
            payment_method,
            payment_status,
            delivery_location
        FROM orders
        WHERE id = UNHEX(?)
          AND user_id = UNHEX(?)
        LIMIT 1
        `,
        [
            orderId,
            userId,
        ],
    );

    if (orderRows.length === 0) {
        return null;
    }

    const order =
        orderRows[0];

    return {
        id: order.id,
        status: order.status,
        subtotal:
            decimalToNumber(
                order.subtotal,
            ),
        totalAmount:
            decimalToNumber(
                order.total_amount,
            ),
        currency:
            order.currency,
        paymentMethod:
            order.payment_method,
        paymentStatus:
            order.payment_status,
        deliveryLocation:
            order.delivery_location,
    };
}

/*
 * ============================================================
 * CUSTOMER / SELLER — MY ORDERS
 * ============================================================
 *
 * Returns ONLY orders belonging to the currently
 * authenticated user.
 *
 * IMPORTANT:
 * We deliberately do NOT accept a userId from
 * the frontend.
 *
 * Ownership comes from req.user.id, which is created
 * by the authenticated session.
 */
router.get(
    '/my-orders',
    requireAuth,
    async (req, res) => {
        try {
            /*
             * Admins have their own order-management
             * endpoint:
             *
             * GET /api/admin/orders
             */
            if (req.user.role === 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    message:
                        'Admin accounts cannot access customer orders.',
                });
            }

            const [orderRows] =
                await db.query(
                    `
                    SELECT
                        HEX(o.id) AS id,
                        o.customer_name,
                        o.customer_phone,
                        o.status,
                        o.subtotal,
                        o.total_amount,
                        o.currency,
                        o.payment_method,
                        o.payment_status,
                        o.delivery_location,
                        o.created_at,
                        o.updated_at
                    FROM orders o
                    WHERE o.user_id = UNHEX(?)
                    ORDER BY
                        o.created_at DESC
                    `,
                    [req.user.id],
                );

            if (orderRows.length === 0) {
                return res.json({
                    success: true,
                    orders: [],
                });
            }

            const orderIds =
                orderRows.map(
                    (order) => order.id,
                );

            /*
             * Build a dynamic IN clause safely.
             *
             * The values themselves are still passed
             * through query parameters.
             */
            const placeholders =
                orderIds
                    .map(() => 'UNHEX(?)')
                    .join(', ');

            const [
                itemRows,
            ] = await db.query(
                `
                SELECT
                    HEX(oi.id) AS id,
                    HEX(oi.order_id) AS order_id,
                    HEX(oi.product_id) AS product_id,
                    HEX(oi.seller_id) AS seller_id,
                    oi.product_name,
                    oi.quantity,
                    oi.unit_price,
                    oi.line_total,
                    sp.shop_name
                FROM order_items oi
                INNER JOIN seller_profiles sp
                    ON sp.id = oi.seller_id
                WHERE oi.order_id IN (
                    ${placeholders}
                )
                ORDER BY
                    oi.created_at ASC
                `,
                orderIds,
            );

            const itemsByOrder =
                new Map();

            for (const item of itemRows) {
                const orderId =
                    item.order_id;

                if (
                    !itemsByOrder.has(
                        orderId,
                    )
                ) {
                    itemsByOrder.set(
                        orderId,
                        [],
                    );
                }

                itemsByOrder
                    .get(orderId)
                    .push({
                        id: item.id,
                        productId:
                            item.product_id,
                        sellerId:
                            item.seller_id,
                        sellerShopName:
                            item.shop_name,
                        productName:
                            item.product_name,
                        quantity:
                            Number(
                                item.quantity,
                            ),
                        unitPrice:
                            decimalToNumber(
                                item.unit_price,
                            ),
                        lineTotal:
                            decimalToNumber(
                                item.line_total,
                            ),
                    });
            }

            const orders =
                orderRows.map(
                    (order) => ({
                        id: order.id,
                        customerName:
                            order.customer_name,
                        customerPhone:
                            order.customer_phone,
                        status:
                            order.status,
                        subtotal:
                            decimalToNumber(
                                order.subtotal,
                            ),
                        totalAmount:
                            decimalToNumber(
                                order.total_amount,
                            ),
                        currency:
                            order.currency,
                        paymentMethod:
                            order.payment_method,
                        paymentStatus:
                            order.payment_status,
                        deliveryLocation:
                            order.delivery_location,
                        createdAt:
                            order.created_at,
                        updatedAt:
                            order.updated_at,
                        items:
                            itemsByOrder.get(
                                order.id,
                            ) || [],
                    }),
                );

            return res.json({
                success: true,
                orders,
            });
        } catch (error) {
            console.error(
                'Get my orders error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to load your orders right now.',
            });
        }
    },
);

/*
 * ============================================================
 * CREATE ORDER
 * ============================================================
 */

router.post(
    '/',
    requireAuth,
    async (req, res) => {
        if (req.user.role === 'ADMIN') {
            return res.status(403).json({
                success: false,
                message:
                    'Admin accounts cannot place customer orders.',
            });
        }

        const idempotencyKey =
            getIdempotencyKey(req);

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                message:
                    'A valid Idempotency-Key header is required.',
            });
        }

        let connection;

        try {
            const {
                customerName,
                customerPhone,
                items,
            } = req.body;

            if (
                typeof customerName !== 'string' ||
                customerName.trim().length < 2 ||
                customerName.trim().length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Please provide a valid customer name.',
                });
            }

            const normalizedCustomerName =
                customerName.trim();

            const phone = normalizePhone(
                customerPhone,
            );

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Please provide a valid phone number.',
                });
            }

            if (
                !Array.isArray(items) ||
                items.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Your bag is empty.',
                });
            }

            if (items.length > 50) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Too many different products in one order.',
                });
            }

            /*
             * Normalize and validate only the fields
             * the customer is allowed to provide.
             *
             * Price, seller, stock, totals, status,
             * category and brand are NEVER trusted
             * from the frontend.
             */
            const requestedItems = new Map();

            for (const item of items) {
                const productId =
                    typeof item?.productId === 'string'
                        ? item.productId
                            .trim()
                            .toLowerCase()
                        : '';

                const quantity = Number(
                    item?.quantity,
                );

                if (!isValidUuid(productId)) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'One or more products are invalid.',
                    });
                }

                if (
                    !Number.isInteger(quantity) ||
                    quantity <= 0 ||
                    quantity > 100
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'One or more product quantities are invalid.',
                    });
                }

                /*
                 * Combine duplicate product IDs instead
                 * of allowing them to bypass quantity checks.
                 */
                const existing =
                    requestedItems.get(
                        productId,
                    ) || 0;

                const combinedQuantity =
                    existing + quantity;

                if (combinedQuantity > 100) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Requested quantity is too high.',
                    });
                }

                requestedItems.set(
                    productId,
                    combinedQuantity,
                );
            }

            /*
             * Create a canonical representation of the
             * normalized checkout request.
             *
             * This means the same logical request produces
             * the same hash even if the frontend supplied
             * duplicate items in a different order.
             */
            const fingerprintItems =
                Array.from(
                    requestedItems.entries(),
                ).map(
                    ([
                        productId,
                        quantity,
                    ]) => ({
                        productId,
                        quantity,
                    }),
                );

            const requestHash =
                createRequestFingerprint({
                    customerName:
                        normalizedCustomerName,
                    customerPhone:
                        phone,
                    items:
                        fingerprintItems,
                });

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            /*
             * ========================================================
             * CLAIM IDEMPOTENCY KEY
             * ========================================================
             *
             * The UNIQUE(user_id, idempotency_key) constraint in the
             * database is the final concurrency guard.
             */
            let existingIdempotency;

            try {
                /*
                 * The migration defines checkout_idempotency.id as
                 * BINARY(16) NOT NULL, so generate the record ID
                 * explicitly instead of relying on the database.
                 */
                const idempotencyRecordId =
                    crypto
                        .randomBytes(16)
                        .toString('hex');

                const [
                    insertResult,
                ] = await connection.query(
                    `
                    INSERT INTO checkout_idempotency (
                        id,
                        user_id,
                        idempotency_key,
                        request_hash,
                        order_id
                    )
                    VALUES (
                        UNHEX(?),
                        UNHEX(?),
                        ?,
                        ?,
                        NULL
                    )
                    `,
                    [
                        idempotencyRecordId,
                        req.user.id,
                        idempotencyKey,
                        requestHash,
                    ],
                );

                if (
                    insertResult.affectedRows !==
                    1
                ) {
                    throw new Error(
                        'Unable to reserve checkout idempotency key.',
                    );
                }
            } catch (error) {
                /*
                 * Duplicate-key means another request has already
                 * claimed this user's idempotency key.
                 *
                 * MySQL error 1062 = ER_DUP_ENTRY.
                 */
                if (error.code !== 'ER_DUP_ENTRY') {
                    throw error;
                }

                const [
                    existingRows,
                ] = await connection.query(
                    `
                    SELECT
                        request_hash,
                        HEX(order_id) AS order_id
                    FROM checkout_idempotency
                    WHERE user_id = UNHEX(?)
                      AND idempotency_key = ?
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        idempotencyKey,
                    ],
                );

                if (
                    existingRows.length === 0
                ) {
                    throw new Error(
                        'Checkout idempotency record disappeared unexpectedly.',
                    );
                }

                existingIdempotency =
                    existingRows[0];

                if (
                    existingIdempotency.request_hash !==
                    requestHash
                ) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            'This Idempotency-Key has already been used for a different checkout request.',
                    });
                }

                /*
                 * The original transaction has committed if we can
                 * observe its idempotency record here.
                 *
                 * If order_id is present, safely return that order.
                 */
                if (
                    existingIdempotency.order_id
                ) {
                    await connection.rollback();

                    const existingOrder =
                        await getExistingOrder(
                            req.user.id,
                            existingIdempotency.order_id,
                        );

                    if (!existingOrder) {
                        return res.status(409).json({
                            success: false,
                            message:
                                'The previous checkout could not be recovered.',
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message:
                            'Order already created for this Idempotency-Key.',
                        order:
                            existingOrder,
                    });
                }

                /*
                 * If we reach here, the idempotency record exists but
                 * has no order. This should not happen after a committed
                 * successful checkout because the key and order are
                 * written in the same transaction.
                 */
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'This checkout is already being processed. Please retry with the same Idempotency-Key.',
                });
            }

            const orderItems = [];

            let subtotal = 0;

            /*
             * Lock each product's inventory row while
             * validating stock.
             *
             * This prevents two simultaneous checkouts
             * from reserving the same stock.
             */
            const sortedRequestedItems = [
                ...requestedItems.entries(),
            ].sort(([productIdA], [productIdB]) =>
                productIdA.localeCompare(productIdB),
            );

            for (const [
                productId,
                requestedQuantity,
            ] of sortedRequestedItems) {
                const [
                    productRows,
                ] = await connection.query(
                    `
                    SELECT
                        p.id,
                        p.name,
                        p.price,
                        p.seller_id,
                        p.status AS product_status,
                        sp.status AS seller_status,
                        c.is_active AS category_active,
                        b.is_active AS brand_active
                    FROM products p
                    INNER JOIN seller_profiles sp
                        ON sp.id = p.seller_id
                    INNER JOIN categories c
                        ON c.id = p.category_id
                    INNER JOIN brands b
                        ON b.id = p.brand_id
                    WHERE p.id = UNHEX(?)
                    LIMIT 1
                    `,
                    [productId],
                );

                if (productRows.length === 0) {
                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            'One or more products could not be found.',
                    });
                }

                const product =
                    productRows[0];

                if (
                    product.product_status !==
                    'ACTIVE'
                ) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            `"${product.name}" is no longer available.`,
                    });
                }

                if (
                    product.seller_status !==
                    'ACTIVE'
                ) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            `"${product.name}" is no longer available.`,
                    });
                }

                if (
                    Number(
                        product.category_active,
                    ) !== 1 ||
                    Number(
                        product.brand_active,
                    ) !== 1
                ) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            `"${product.name}" is no longer available.`,
                    });
                }

                /*
                 * Inventory is locked here.
                 */
                const [
                    inventoryRows,
                ] = await connection.query(
                    `
                    SELECT
                        quantity,
                        reserved_quantity
                    FROM product_inventory
                    WHERE product_id = UNHEX(?)
                    FOR UPDATE
                    `,
                    [productId],
                );

                if (inventoryRows.length === 0) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            `"${product.name}" has no inventory record.`,
                    });
                }

                const inventory =
                    inventoryRows[0];

                const availableQuantity =
                    Number(
                        inventory.quantity,
                    ) -
                    Number(
                        inventory.reserved_quantity,
                    );

                if (
                    requestedQuantity >
                    availableQuantity
                ) {
                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            `"${product.name}" does not have enough stock.`,
                        availableQuantity,
                    });
                }

                const unitPrice =
                    decimalToNumber(
                        product.price,
                    );

                const lineTotal =
                    Math.round(
                        unitPrice *
                        requestedQuantity *
                        100,
                    ) / 100;

                subtotal += lineTotal;

                orderItems.push({
                    productId,
                    sellerId:
                        product.seller_id.toString(
                            'hex',
                        ),
                    productName:
                        product.name,
                    quantity:
                        requestedQuantity,
                    unitPrice,
                    lineTotal,
                });
            }

            subtotal =
                Math.round(
                    subtotal * 100,
                ) / 100;

            const orderId =
                crypto
                    .randomBytes(16)
                    .toString('hex');

            /*
             * Delivery and payment values are fixed
             * on the backend.
             *
             * The frontend cannot override them.
             */
            await connection.query(
                `
                INSERT INTO orders (
                    id,
                    user_id,
                    customer_name,
                    customer_phone,
                    status,
                    subtotal,
                    total_amount,
                    currency,
                    payment_method,
                    payment_status,
                    delivery_location
                )
                VALUES (
                    UNHEX(?),
                    UNHEX(?),
                    ?,
                    ?,
                    'PENDING',
                    ?,
                    ?,
                    'INR',
                    'COD',
                    'PENDING',
                    ?
                )
                `,
                [
                    orderId,
                    req.user.id,
                    normalizedCustomerName,
                    phone,
                    subtotal,
                    subtotal,
                    DELIVERY_LOCATION,
                ],
            );

            /*
             * Insert every order line using the values
             * retrieved from the database.
             */
            for (const item of orderItems) {
                const orderItemId =
                    crypto
                        .randomBytes(16)
                        .toString('hex');

                await connection.query(
                    `
                    INSERT INTO order_items (
                        id,
                        order_id,
                        product_id,
                        seller_id,
                        product_name,
                        quantity,
                        unit_price,
                        line_total
                    )
                    VALUES (
                        UNHEX(?),
                        UNHEX(?),
                        UNHEX(?),
                        UNHEX(?),
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    [
                        orderItemId,
                        orderId,
                        item.productId,
                        item.sellerId,
                        item.productName,
                        item.quantity,
                        item.unitPrice,
                        item.lineTotal,
                    ],
                );

                /*
                 * Reserve the stock inside the same
                 * transaction.
                 */
                await connection.query(
                    `
                    UPDATE product_inventory
                    SET reserved_quantity =
                        reserved_quantity + ?
                    WHERE product_id = UNHEX(?)
                    `,
                    [
                        item.quantity,
                        item.productId,
                    ],
                );
            }

            /*
             * Link the idempotency record to the newly created order
             * BEFORE committing the transaction.
             *
             * Therefore:
             *
             * order + inventory reservation + idempotency record
             *
             * all commit together.
             */
            const [
                idempotencyUpdateResult,
            ] = await connection.query(
                `
                UPDATE checkout_idempotency
                SET order_id = UNHEX(?)
                WHERE user_id = UNHEX(?)
                  AND idempotency_key = ?
                  AND request_hash = ?
                  AND order_id IS NULL
                `,
                [
                    orderId,
                    req.user.id,
                    idempotencyKey,
                    requestHash,
                ],
            );

            /*
             * The idempotency record must be linked successfully.
             *
             * If this fails, roll back the entire checkout so that
             * we never create an order that cannot be recovered
             * through its Idempotency-Key.
             */
            if (
                idempotencyUpdateResult.affectedRows !==
                1
            ) {
                throw new Error(
                    'Unable to link checkout idempotency record to order.',
                );
            }

            await connection.commit();

            return res.status(201).json({
                success: true,
                message:
                    'Order placed successfully.',
                order: {
                    id: orderId,
                    status: 'PENDING',
                    subtotal,
                    totalAmount: subtotal,
                    currency: 'INR',
                    paymentMethod:
                        PAYMENT_METHOD,
                    paymentStatus:
                        'PENDING',
                    deliveryLocation:
                        DELIVERY_LOCATION,
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        'Order rollback failed:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Create order error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to place the order right now.',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);

module.exports = router;