import React, {
    useEffect,
    useState,
} from 'react';

import {
    getSellerOrders,
    markSellerOrderReady,
} from './sellerOrderStore';

export default function SellerOrders({
    isOpen,
    onToast,
}) {
    const [orders, setOrders] =
        useState([]);

    const [isLoading, setIsLoading] =
        useState(false);

    const [readyOrderId, setReadyOrderId] =
        useState(null);

    const loadOrders = async () => {
        setIsLoading(true);

        try {
            const data =
                await getSellerOrders();

            setOrders(
                Array.isArray(data)
                    ? data
                    : [],
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to load seller orders.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        loadOrders();
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const formatPrice = (price) => {
        return `₹${Number(price).toLocaleString(
            'en-IN',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            },
        )}`;
    };

    const formatDate = (date) => {
        if (!date) {
            return '—';
        }

        const parsedDate =
            new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime(),
            )
        ) {
            return '—';
        }

        return parsedDate.toLocaleDateString(
            'en-IN',
            {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            },
        );
    };

    const getOrderTotal = (order) => {
        return order.items.reduce(
            (total, item) =>
                total +
                Number(item.lineTotal || 0),
            0,
        );
    };

    const canMarkReady = (order) => {
        if (
            order.status !==
            'PROCESSING'
        ) {
            return false;
        }

        if (!Array.isArray(order.items)) {
            return false;
        }

        return order.items.some(
            (item) =>
                item.fulfillmentStatus !==
                'READY',
        );
    };

    const handleMarkReady = async (
        order,
    ) => {
        if (
            readyOrderId ||
            !canMarkReady(order)
        ) {
            return;
        }

        setReadyOrderId(order.id);

        try {
            await markSellerOrderReady(
                order.id,
            );

            await loadOrders();

            onToast(
                'Your items are now ready for delivery.',
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to mark your items ready.',
            );
        } finally {
            setReadyOrderId(null);
        }
    };

    return (
        <div className="seller-orders">
            <div className="seller-dashboard-section">
                <div className="section-top">
                    <div>
                        <div className="eyebrow">
                            Orders
                        </div>

                        <h3>
                            Your orders
                        </h3>
                    </div>

                    <button
                        className="seller-product-preview"
                        type="button"
                        onClick={loadOrders}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? 'LOADING...'
                            : 'REFRESH'}
                    </button>
                </div>

                {isLoading &&
                    orders.length === 0 ? (
                    <div className="seller-empty">
                        <strong>
                            Loading your orders.
                        </strong>

                        <p>
                            Fetching orders
                            containing your
                            products.
                        </p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="seller-empty">
                        <strong>
                            No orders yet.
                        </strong>

                        <p>
                            Orders containing
                            your products will
                            appear here.
                        </p>
                    </div>
                ) : (
                    <div className="seller-orders-list">
                        {orders.map(
                            (order) => (
                                <article
                                    key={order.id}
                                    className="seller-order-card"
                                >
                                    <div className="seller-order-header">
                                        <div>
                                            <div className="seller-order-label">
                                                ORDER
                                            </div>

                                            <strong>
                                                #
                                                {order.id.slice(
                                                    0,
                                                    8,
                                                ).toUpperCase()}
                                            </strong>
                                        </div>

                                        <div className="seller-order-status">
                                            {
                                                order.status
                                            }
                                        </div>
                                    </div>

                                    <div className="seller-order-meta">
                                        <div>
                                            <span>
                                                CUSTOMER
                                            </span>

                                            <strong>
                                                {
                                                    order.customerName
                                                }
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                ORDERED
                                            </span>

                                            <strong>
                                                {formatDate(
                                                    order.createdAt,
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                YOUR TOTAL
                                            </span>

                                            <strong>
                                                {formatPrice(
                                                    getOrderTotal(
                                                        order,
                                                    ),
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="seller-order-items">
                                        {order.items.map(
                                            (
                                                item,
                                            ) => (
                                                <div
                                                    key={
                                                        item.id
                                                    }
                                                    className="seller-order-item"
                                                >
                                                    <div>
                                                        <strong>
                                                            {
                                                                item.productName
                                                            }
                                                        </strong>

                                                        <span>
                                                            Qty:{' '}
                                                            {
                                                                item.quantity
                                                            }
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {formatPrice(
                                                                item.lineTotal,
                                                            )}
                                                        </strong>

                                                        <span
                                                            className={`seller-fulfillment-status seller-fulfillment-${String(
                                                                item.fulfillmentStatus ||
                                                                'PENDING',
                                                            ).toLowerCase()}`}
                                                        >
                                                            {
                                                                item.fulfillmentStatus
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>

                                    {canMarkReady(
                                        order,
                                    ) && (
                                            <div className="seller-order-actions">
                                                <button
                                                    className="primary"
                                                    type="button"
                                                    disabled={
                                                        readyOrderId ===
                                                        order.id ||
                                                        Boolean(
                                                            readyOrderId,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        handleMarkReady(
                                                            order,
                                                        )
                                                    }
                                                >
                                                    {readyOrderId ===
                                                        order.id
                                                        ? 'MARKING READY...'
                                                        : 'MARK MY ITEMS READY'}
                                                </button>
                                            </div>
                                        )}
                                </article>
                            ),
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}