const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const db = require('../db');

const router = express.Router();

router.use(
    requireAuth,
    requireRole('SELLER'),
);

/*
 * ============================================================
 * GET SELLER ORDERS
 * ============================================================
 *
 * Seller ownership is ALWAYS derived from the authenticated
 * session.
 *
 * No seller ID is accepted from the frontend.
 *
 * Seller A can therefore only retrieve order_items where:
 *
 *     order_items.seller_id
 *          =
 *     seller_profiles.id
 *
 * for the seller profile belonging to req.user.id.
 */
router.get('/', async (req, res) => {
    try {
        const [sellerRows] =
            await db.execute(
                `
                SELECT
                    id,
                    shop_name,
                    status
                FROM seller_profiles
                WHERE user_id = UNHEX(?)
                LIMIT 1
                `,
                [req.user.id],
            );

        if (sellerRows.length === 0) {
            return res.status(403).json({
                success: false,
                message:
                    'Seller profile not found.',
            });
        }

        const seller =
            sellerRows[0];

        const [rows] =
            await db.execute(
                `
                SELECT
                    o.id AS order_id,
                    o.customer_name,
                    o.status AS order_status,
                    o.payment_method,
                    o.payment_status,
                    o.delivery_location,
                    o.created_at,
                    o.updated_at,

                    oi.id AS item_id,
                    oi.product_id,
                    oi.product_name,
                    oi.quantity,
                    oi.unit_price,
                    oi.line_total,
                    oi.fulfillment_status,
                    oi.seller_ready_at

                FROM orders o

                INNER JOIN order_items oi
                    ON oi.order_id = o.id

                WHERE oi.seller_id = ?

                ORDER BY
                    CASE
                        WHEN o.status = 'PENDING'
                            THEN 0
                        WHEN o.status = 'CONFIRMED'
                            THEN 1
                        WHEN o.status = 'PROCESSING'
                            THEN 2
                        WHEN o.status = 'COMPLETED'
                            THEN 3
                        WHEN o.status = 'CANCELLED'
                            THEN 4
                        ELSE 5
                    END,
                    o.created_at DESC,
                    oi.created_at ASC
                `,
                [seller.id],
            );

        const ordersMap =
            new Map();

        for (const row of rows) {
            const orderId =
                row.order_id.toString(
                    'hex',
                );

            if (!ordersMap.has(orderId)) {
                ordersMap.set(
                    orderId,
                    {
                        id: orderId,

                        customerName:
                            row.customer_name,

                        status:
                            row.order_status,

                        paymentMethod:
                            row.payment_method,

                        paymentStatus:
                            row.payment_status,

                        deliveryLocation:
                            row.delivery_location,

                        createdAt:
                            row.created_at,

                        updatedAt:
                            row.updated_at,

                        items: [],
                    },
                );
            }

            ordersMap
                .get(orderId)
                .items.push({
                    id: row.item_id.toString(
                        'hex',
                    ),

                    productId:
                        row.product_id.toString(
                            'hex',
                        ),

                    productName:
                        row.product_name,

                    quantity:
                        Number(
                            row.quantity,
                        ),

                    unitPrice:
                        Number(
                            row.unit_price,
                        ),

                    lineTotal:
                        Number(
                            row.line_total,
                        ),

                    fulfillmentStatus:
                        row.fulfillment_status,

                    sellerReadyAt:
                        row.seller_ready_at,
                });
        }

        return res.json({
            success: true,

            seller: {
                shopName:
                    seller.shop_name,

                status:
                    seller.status,
            },

            orders: Array.from(
                ordersMap.values(),
            ),
        });
    } catch (error) {
        console.error(
            'Seller order lookup error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to retrieve seller orders right now.',
        });
    }
});

/*
 * ============================================================
 * MARK SELLER ITEMS READY
 * ============================================================
 *
 * PATCH /api/seller/orders/:orderId/ready
 *
 * The seller does NOT specify which order items to modify.
 *
 * The backend finds every item in this order belonging
 * to the authenticated seller and marks those items READY.
 *
 * This is intentional:
 *
 *     req.user.id
 *          ↓
 *     seller_profiles.id
 *          ↓
 *     order_items.seller_id
 *
 * The frontend cannot substitute another seller's ID.
 */
router.patch(
    '/:orderId/ready',
    async (req, res) => {
        let connection;

        try {
            const orderId =
                typeof req.params.orderId ===
                    'string'
                    ? req.params.orderId
                        .trim()
                        .toLowerCase()
                    : '';

            /*
             * Order IDs are 16-byte binary UUIDs represented
             * as 32 hexadecimal characters.
             */
            if (
                !/^[0-9a-f]{32}$/.test(
                    orderId,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid order ID.',
                });
            }

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            /*
             * ----------------------------------------------------
             * 1. Resolve seller from authenticated session.
             * ----------------------------------------------------
             *
             * NEVER use a seller ID supplied by the client.
             */
            const [
                sellerRows,
            ] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        status
                    FROM seller_profiles
                    WHERE user_id = UNHEX(?)
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [req.user.id],
                );

            if (
                sellerRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found.',
                });
            }

            const seller =
                sellerRows[0];

            /*
             * A suspended/inactive seller must not be
             * able to perform seller fulfillment actions.
             */
            if (
                seller.status !==
                'ACTIVE'
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Your seller account is not active.',
                });
            }

            /*
             * ----------------------------------------------------
             * 2. Lock the order.
             * ----------------------------------------------------
             */
            const [
                orderRows,
            ] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        status
                    FROM orders
                    WHERE id = UNHEX(?)
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [orderId],
                );

            if (
                orderRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Order not found.',
                });
            }

            const order =
                orderRows[0];

            /*
             * ----------------------------------------------------
             * 3. Validate the overall order state.
             * ----------------------------------------------------
             *
             * Sellers may ONLY mark items ready once
             * the admin has moved the order to PROCESSING.
             *
             * IMPORTANT:
             *
             * READY is NOT an overall order status.
             * Seller fulfillment is tracked at order-item level.
             */
            if (
                order.status !==
                'PROCESSING'
            ) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'This order is not currently being prepared.',
                });
            }

            /*
             * ----------------------------------------------------
             * 4. Lock this seller's items for this order.
             * ----------------------------------------------------
             *
             * This WHERE clause is the critical ownership
             * boundary.
             *
             * Even if a seller knows another seller's order
             * or item IDs, only rows belonging to THIS seller
             * can be selected or modified.
             */
            const [
                sellerItems,
            ] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        fulfillment_status
                    FROM order_items
                    WHERE order_id = UNHEX(?)
                      AND seller_id = ?
                    FOR UPDATE
                    `,
                    [
                        orderId,
                        seller.id,
                    ],
                );

            if (
                sellerItems.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'This order does not contain any items belonging to your shop.',
                });
            }

            /*
             * ----------------------------------------------------
             * 5. Enforce the fulfillment state machine.
             * ----------------------------------------------------
             *
             * The only valid transition performed by this
             * endpoint is:
             *
             *     PENDING -> READY
             *
             * READY and DELIVERED items must never be rewritten.
             *
             * This prevents:
             *
             *     READY -> READY
             *     DELIVERED -> READY
             *
             * and ensures this endpoint cannot move an item
             * backwards in the fulfillment lifecycle.
             */
            const pendingItems =
                sellerItems.filter(
                    (item) =>
                        item.fulfillment_status ===
                        'PENDING',
                );

            /*
             * If there are no PENDING items, this seller has
             * nothing that this endpoint is allowed to transition.
             */
            if (
                pendingItems.length ===
                0
            ) {
                const allItemsReady =
                    sellerItems.every(
                        (item) =>
                            item.fulfillment_status ===
                            'READY',
                    );

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        allItemsReady
                            ? 'Your items for this order are already marked ready.'
                            : 'Your items for this order cannot be marked ready from their current fulfillment state.',
                });
            }

            /*
             * ----------------------------------------------------
             * 6. Mark ONLY this seller's PENDING items READY.
             * ----------------------------------------------------
             *
             * seller_ready_at is generated by the database.
             *
             * The fulfillment state transition is explicitly:
             *
             *     PENDING -> READY
             */
            await connection.execute(
                `
                UPDATE order_items
                SET
                    fulfillment_status = 'READY',
                    seller_ready_at =
                        CURRENT_TIMESTAMP(6)
                WHERE order_id = UNHEX(?)
                  AND seller_id = ?
                  AND fulfillment_status = 'PENDING'
                `,
                [
                    orderId,
                    seller.id,
                ],
            );

            /*
             * ----------------------------------------------------
             * 7. Check whether EVERY item belonging to THIS
             *    seller is now READY.
             * ----------------------------------------------------
             *
             * This is a seller-level fulfillment result.
             *
             * It does NOT change orders.status.
             *
             * The global order remains PROCESSING until the
             * appropriate later workflow completes.
             */
            const [
                sellerItemsAfterUpdate,
            ] =
                await connection.execute(
                    `
                    SELECT
                        fulfillment_status
                    FROM order_items
                    WHERE order_id = UNHEX(?)
                      AND seller_id = ?
                    FOR UPDATE
                    `,
                    [
                        orderId,
                        seller.id,
                    ],
                );

            const allItemsReady =
                sellerItemsAfterUpdate.every(
                    (item) =>
                        item.fulfillment_status ===
                        'READY',
                );

            /*
             * ----------------------------------------------------
             * 8. IMPORTANT:
             *
             * NEVER change orders.status to READY.
             *
             * READY is an item-level fulfillment state.
             *
             * The overall order remains PROCESSING.
             * ----------------------------------------------------
             */

            await connection.commit();

            return res.json({
                success: true,

                message:
                    allItemsReady
                        ? 'Your items have been marked ready.'
                        : 'Your pending items have been marked ready.',

                orderStatus:
                    'PROCESSING',

                sellerFulfillmentStatus:
                    'READY',

                allItemsReady:
                    allItemsReady,
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        'Seller order rollback failed:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Seller mark ready error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to mark the order ready right now.',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);

module.exports = router;