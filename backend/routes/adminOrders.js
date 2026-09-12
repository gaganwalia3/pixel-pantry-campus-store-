const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const db = require('../db');

const router = express.Router();

router.use(
    requireAuth,
    requireRole('ADMIN'),
);

const ORDER_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
];

const ACTIVE_ORDER_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
];

const FULFILLMENT_STATUSES = [
    'PENDING',
    'READY',
    'DELIVERED',
];

const isValidHexId = (value) => {
    return (
        typeof value === 'string' &&
        /^[0-9a-f]{32}$/.test(value)
    );
};

const hexToBuffer = (value) => {
    return Buffer.from(value, 'hex');
};

/*
 * Get all orders for admin.
 *
 * IMPORTANT:
 * Order-level status and item-level fulfillment
 * status are intentionally kept separate.
 *
 * order.status:
 * PENDING
 * CONFIRMED
 * PROCESSING
 * COMPLETED
 * CANCELLED
 *
 * order_item.fulfillment_status:
 * PENDING
 * READY
 * DELIVERED
 *
 * This allows split delivery between sellers.
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
            SELECT
                o.id AS order_id,
                o.user_id,
                o.customer_name,
                o.customer_phone,
                o.status AS order_status,
                o.subtotal,
                o.total_amount,
                o.currency,
                o.payment_method,
                o.payment_status,
                o.delivery_location,
                o.created_at,
                o.updated_at,

                oi.id AS item_id,
                oi.product_id,
                oi.seller_id,
                oi.product_name,
                oi.quantity,
                oi.unit_price,
                oi.line_total,
                oi.fulfillment_status,
                oi.seller_ready_at,

                sp.shop_name AS seller_shop_name

            FROM orders o

            LEFT JOIN order_items oi
                ON oi.order_id = o.id

            LEFT JOIN seller_profiles sp
                ON sp.id = oi.seller_id

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
                o.created_at DESC
            `,
        );

        const ordersMap = new Map();

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

                        userId:
                            row.user_id.toString(
                                'hex',
                            ),

                        customerName:
                            row.customer_name,

                        customerPhone:
                            row.customer_phone,

                        status:
                            row.order_status,

                        subtotal:
                            Number(
                                row.subtotal,
                            ),

                        totalAmount:
                            Number(
                                row.total_amount,
                            ),

                        currency:
                            row.currency,

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

            /*
             * LEFT JOIN means an order can technically
             * appear without an item. Only add an item
             * when an actual item row exists.
             */
            if (row.item_id) {
                ordersMap
                    .get(orderId)
                    .items.push({
                        id:
                            row.item_id.toString(
                                'hex',
                            ),

                        productId:
                            row.product_id.toString(
                                'hex',
                            ),

                        sellerId:
                            row.seller_id.toString(
                                'hex',
                            ),

                        sellerShopName:
                            row.seller_shop_name,

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
        }

        return res.json({
            success: true,
            orders: Array.from(
                ordersMap.values(),
            ),
        });
    } catch (error) {
        console.error(
            'Admin order lookup error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to retrieve orders',
        });
    }
});

/*
 * Update the overall order workflow status.
 *
 * Delivery is NOT controlled here.
 *
 * Valid workflow:
 *
 * PENDING
 *   ↓
 * CONFIRMED
 *   ↓
 * PROCESSING
 *
 * PROCESSING → CANCELLED
 * PENDING     → CANCELLED
 * CONFIRMED   → CANCELLED
 *
 * COMPLETED is assigned automatically by the
 * item-delivery endpoint when every item is DELIVERED.
 *
 * READY is deliberately NOT an order-level status
 * for the split-delivery workflow.
 */
router.patch(
    '/:id/status',
    async (req, res) => {
        const connection =
            await db.getConnection();

        let transactionStarted = false;

        try {
            const {
                status,
            } = req.body;

            if (
                typeof status !==
                'string' ||
                !ORDER_STATUSES.includes(
                    status,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid order status',
                });
            }

            if (
                status === 'READY'
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        'READY is managed per seller item, not at order level',
                });
            }

            if (
                status === 'COMPLETED'
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        'Orders are completed automatically after all items are delivered',
                });
            }

            if (
                !isValidHexId(
                    req.params.id,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid order id',
                });
            }

            const orderId =
                hexToBuffer(
                    req.params.id,
                );

            await connection.beginTransaction();

            transactionStarted = true;

            /*
             * Lock the order before making any
             * state transition.
             */
            const [orders] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        status,
                        payment_status
                    FROM orders
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [orderId],
                );

            if (orders.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(404).json({
                    success: false,
                    message:
                        'Order not found',
                });
            }

            const order =
                orders[0];

            /*
             * Terminal orders cannot be modified.
             */
            if (
                order.status ===
                'COMPLETED' ||
                order.status ===
                'CANCELLED'
            ) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message:
                        'Completed or cancelled orders cannot be changed',
                });
            }

            /*
             * Strict state-transition enforcement.
             *
             * PENDING    → CONFIRMED / CANCELLED
             * CONFIRMED  → PROCESSING / CANCELLED
             * PROCESSING → CANCELLED
             */
            const validTransition =
                (
                    order.status ===
                    'PENDING' &&
                    (
                        status ===
                        'CONFIRMED' ||
                        status ===
                        'CANCELLED'
                    )
                ) ||
                (
                    order.status ===
                    'CONFIRMED' &&
                    (
                        status ===
                        'PROCESSING' ||
                        status ===
                        'CANCELLED'
                    )
                ) ||
                (
                    order.status ===
                    'PROCESSING' &&
                    status ===
                    'CANCELLED'
                );

            if (!validTransition) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message:
                        `Invalid order transition from ${order.status} to ${status}`,
                });
            }

            /*
             * Cancellation is only possible while
             * no item has already been delivered.
             *
             * Once something has physically been
             * delivered, the order cannot be globally
             * cancelled.
             */
            if (
                status ===
                'CANCELLED'
            ) {
                const [
                    deliveredItems,
                ] =
                    await connection.execute(
                        `
                        SELECT
                            id
                        FROM order_items
                        WHERE
                            order_id = ?
                            AND fulfillment_status = 'DELIVERED'
                        LIMIT 1
                        `,
                        [order.id],
                    );

                if (
                    deliveredItems.length >
                    0
                ) {
                    await connection.rollback();
                    transactionStarted = false;

                    return res.status(409).json({
                        success: false,
                        message:
                            'An order with delivered items cannot be cancelled',
                    });
                }
            }

            /*
             * Payment remains pending until the order
             * is actually completed.
             *
             * COD is the current payment method.
             */
            await connection.execute(
                `
                UPDATE orders
                SET
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                `,
                [
                    status,
                    order.id,
                ],
            );

            /*
             * Cancellation releases all outstanding
             * inventory reservations.
             *
             * Inventory rows are locked before
             * changing reserved_quantity.
             */
            if (
                status ===
                'CANCELLED'
            ) {
                const [items] =
                    await connection.execute(
                        `
                        SELECT
                            id,
                            product_id,
                            quantity,
                            fulfillment_status
                        FROM order_items
                        WHERE order_id = ?
                        FOR UPDATE
                        `,
                        [order.id],
                    );

                for (const item of items) {
                    /*
                     * Delivered inventory has already
                     * been deducted and must not be
                     * released again.
                     */
                    if (
                        item.fulfillment_status ===
                        'DELIVERED'
                    ) {
                        continue;
                    }

                    const [
                        inventoryRows,
                    ] =
                        await connection.execute(
                            `
                            SELECT
                                quantity,
                                reserved_quantity
                            FROM product_inventory
                            WHERE product_id = ?
                            LIMIT 1
                            FOR UPDATE
                            `,
                            [
                                item.product_id,
                            ],
                        );

                    if (
                        inventoryRows.length ===
                        0
                    ) {
                        throw new Error(
                            'Inventory record missing for cancelled order item',
                        );
                    }

                    const reservedQuantity =
                        Number(
                            inventoryRows[0]
                                .reserved_quantity,
                        );

                    const orderQuantity =
                        Number(
                            item.quantity,
                        );

                    if (
                        reservedQuantity <
                        orderQuantity
                    ) {
                        throw new Error(
                            'Reserved inventory is lower than the order quantity',
                        );
                    }

                    await connection.execute(
                        `
                        UPDATE product_inventory
                        SET
                            reserved_quantity =
                                reserved_quantity - ?
                        WHERE product_id = ?
                        `,
                        [
                            orderQuantity,
                            item.product_id,
                        ],
                    );
                }

                /*
                 * Mark every not-yet-delivered item as
                 * cancelled so its fulfillment state
                 * cannot later be moved to READY.
                 */
                await connection.execute(
                    `
                    UPDATE order_items
                    SET
                        fulfillment_status = 'CANCELLED'
                    WHERE
                        order_id = ?
                        AND fulfillment_status != 'DELIVERED'
                    `,
                    [order.id],
                );
            }

            await connection.commit();
            transactionStarted = false;

            return res.json({
                success: true,
                message:
                    'Order status updated successfully',
                status,
                paymentStatus:
                    order.payment_status,
            });
        } catch (error) {
            if (
                transactionStarted
            ) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Admin order rollback error:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Admin order status update error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to update order status',
            });
        } finally {
            connection.release();
        }
    },
);

/*
 * Mark one seller/item portion as DELIVERED.
 *
 * This is the admin-side delivery operation for
 * split delivery.
 *
 * Security:
 * - Admin authentication is enforced by router.use().
 * - orderId is validated.
 * - itemId is validated.
 * - item must belong to the specified order.
 * - item is locked FOR UPDATE.
 * - inventory is locked FOR UPDATE.
 * - only READY items can become DELIVERED.
 *
 * The frontend does NOT decide whether an item
 * belongs to a seller or order.
 */
router.patch(
    '/:orderId/items/:itemId/deliver',
    async (req, res) => {
        const connection =
            await db.getConnection();

        let transactionStarted = false;

        try {
            const {
                orderId,
                itemId,
            } = req.params;

            if (
                !isValidHexId(
                    orderId,
                ) ||
                !isValidHexId(
                    itemId,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid order or item id',
                });
            }

            const orderBuffer =
                hexToBuffer(
                    orderId,
                );

            const itemBuffer =
                hexToBuffer(
                    itemId,
                );

            await connection.beginTransaction();

            transactionStarted = true;

            /*
             * Lock the order first.
             */
            const [orders] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        status,
                        payment_status
                    FROM orders
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [orderBuffer],
                );

            if (orders.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(404).json({
                    success: false,
                    message:
                        'Order not found',
                });
            }

            const order =
                orders[0];

            /*
             * Delivery is only possible while the
             * overall order is PROCESSING.
             */
            if (
                order.status !==
                'PROCESSING'
            ) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message:
                        'Items can only be delivered while the order is processing',
                });
            }

            /*
             * Lock the exact order item and make
             * sure it belongs to this order.
             */
            const [items] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        order_id,
                        product_id,
                        quantity,
                        fulfillment_status
                    FROM order_items
                    WHERE
                        id = ?
                        AND order_id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        itemBuffer,
                        orderBuffer,
                    ],
                );

            if (items.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(404).json({
                    success: false,
                    message:
                        'Order item not found',
                });
            }

            const item =
                items[0];

            /*
             * Only READY items can be delivered.
             *
             * This prevents:
             * PENDING → DELIVERED
             * DELIVERED → DELIVERED
             */
            if (
                item.fulfillment_status !==
                'READY'
            ) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message:
                        `Item cannot be delivered from ${item.fulfillment_status} status`,
                });
            }

            /*
             * Lock inventory before deducting the
             * physically delivered quantity.
             */
            const [
                inventoryRows,
            ] =
                await connection.execute(
                    `
                    SELECT
                        quantity,
                        reserved_quantity
                    FROM product_inventory
                    WHERE product_id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [item.product_id],
                );

            if (
                inventoryRows.length ===
                0
            ) {
                throw new Error(
                    'Inventory record missing for delivered order item',
                );
            }

            const inventory =
                inventoryRows[0];

            const inventoryQuantity =
                Number(
                    inventory.quantity,
                );

            const reservedQuantity =
                Number(
                    inventory.reserved_quantity,
                );

            const itemQuantity =
                Number(
                    item.quantity,
                );

            /*
             * Both quantities must be sufficient.
             *
             * quantity is physical stock.
             * reserved_quantity is the portion
             * currently held for orders.
             */
            if (
                inventoryQuantity <
                itemQuantity
            ) {
                throw new Error(
                    'Inventory quantity is lower than the delivered order quantity',
                );
            }

            if (
                reservedQuantity <
                itemQuantity
            ) {
                throw new Error(
                    'Reserved inventory is lower than the delivered order quantity',
                );
            }

            /*
             * Physically deliver the inventory:
             *
             * quantity          -= delivered amount
             * reserved_quantity -= delivered amount
             */
            await connection.execute(
                `
                UPDATE product_inventory
                SET
                    quantity =
                        quantity - ?,
                    reserved_quantity =
                        reserved_quantity - ?
                WHERE product_id = ?
                `,
                [
                    itemQuantity,
                    itemQuantity,
                    item.product_id,
                ],
            );

            /*
             * Mark this exact item as delivered.
             */
            await connection.execute(
                `
                UPDATE order_items
                SET
                    fulfillment_status = 'DELIVERED'
                WHERE
                    id = ?
                    AND order_id = ?
                    AND fulfillment_status = 'READY'
                `,
                [
                    item.id,
                    order.id,
                ],
            );

            /*
             * Check whether every item in the order
             * has now been delivered.
             */
            const [
                remainingItems,
            ] =
                await connection.execute(
                    `
                    SELECT
                        COUNT(*) AS remaining_count
                    FROM order_items
                    WHERE
                        order_id = ?
                        AND fulfillment_status != 'DELIVERED'
                    `,
                    [order.id],
                );

            const remainingCount =
                Number(
                    remainingItems[0]
                        .remaining_count,
                );

            let orderStatus =
                order.status;

            let paymentStatus =
                order.payment_status;

            /*
             * Only the backend can transition the
             * overall order to COMPLETED.
             *
             * This happens only when every item has
             * been delivered.
             */
            if (
                remainingCount ===
                0
            ) {
                orderStatus =
                    'COMPLETED';

                /*
                 * Current payment method is COD,
                 * so payment becomes PAID when the
                 * entire order is completed.
                 */
                paymentStatus =
                    'PAID';

                await connection.execute(
                    `
                    UPDATE orders
                    SET
                        status = 'COMPLETED',
                        payment_status = 'PAID',
                        updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ?
                    `,
                    [order.id],
                );
            } else {
                await connection.execute(
                    `
                    UPDATE orders
                    SET
                        updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ?
                    `,
                    [order.id],
                );
            }

            await connection.commit();
            transactionStarted = false;

            return res.json({
                success: true,
                message:
                    remainingCount === 0
                        ? 'Item delivered and order completed.'
                        : 'Seller item marked as delivered.',
                itemId:
                    item.id.toString(
                        'hex',
                    ),
                fulfillmentStatus:
                    'DELIVERED',
                orderStatus,
                paymentStatus,
                allItemsDelivered:
                    remainingCount ===
                    0,
            });
        } catch (error) {
            if (
                transactionStarted
            ) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Admin delivery rollback error:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Admin order delivery error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to mark item as delivered',
            });
        } finally {
            connection.release();
        }
    },
);

module.exports = router;