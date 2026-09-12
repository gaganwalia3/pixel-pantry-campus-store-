import React, {
    useEffect,
    useState,
} from 'react';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

const STATUS_LABELS = {
    PENDING: 'Order received',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Being prepared',
    READY: 'Ready for delivery',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

const STATUS_STEPS = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY',
    'COMPLETED',
];

function formatPrice(value) {
    return (
        '₹' +
        Number(value).toLocaleString(
            'en-IN',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            },
        )
    );
}

function formatDate(value) {
    if (!value) {
        return '';
    }

    return new Date(value).toLocaleString(
        'en-IN',
        {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        },
    );
}

function getStatusIndex(status) {
    return STATUS_STEPS.indexOf(status);
}

function StatusTracker({ status }) {
    if (status === 'CANCELLED') {
        return (
            <div className="my-orders-cancelled">
                <span className="my-orders-status-dot">
                    ×
                </span>

                <div>
                    <strong>
                        Order cancelled
                    </strong>

                    <p>
                        This order will not be
                        delivered.
                    </p>
                </div>
            </div>
        );
    }

    const currentIndex =
        getStatusIndex(status);

    return (
        <div className="my-orders-tracker">
            {STATUS_STEPS.map(
                (step, index) => {
                    const isComplete =
                        index <= currentIndex;

                    return (
                        <div
                            key={step}
                            className={`my-orders-step ${isComplete
                                    ? 'complete'
                                    : ''
                                } ${index === currentIndex
                                    ? 'current'
                                    : ''
                                }`}
                        >
                            <span className="my-orders-step-dot">
                                {isComplete
                                    ? '✓'
                                    : index + 1}
                            </span>

                            <small>
                                {
                                    STATUS_LABELS[
                                    step
                                    ]
                                }
                            </small>
                        </div>
                    );
                },
            )}
        </div>
    );
}

export default function MyOrders({
    isOpen,
    onClose,
    session,
    onOpenProduct,
}) {
    const [orders, setOrders] =
        useState([]);

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] =
        useState('');

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!session?.isAuthenticated) {
            return;
        }

        let cancelled = false;

        const loadOrders = async () => {
            try {
                setIsLoading(true);
                setError('');

                const response =
                    await fetch(
                        `${API_URL}/api/orders/my-orders`,
                        {
                            method: 'GET',
                            credentials: 'include',
                        },
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        'Unable to load your orders.',
                    );
                }

                if (!cancelled) {
                    setOrders(
                        Array.isArray(
                            data.orders,
                        )
                            ? data.orders
                            : [],
                    );
                }
            } catch (requestError) {
                console.error(
                    'My orders failed to load:',
                    requestError,
                );

                if (!cancelled) {
                    setError(
                        requestError.message ||
                        'Unable to load your orders.',
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadOrders();

        return () => {
            cancelled = true;
        };
    }, [
        isOpen,
        session?.isAuthenticated,
    ]);

    if (!isOpen) {
        return null;
    }

    const handleProductClick = (
        productId,
    ) => {
        onClose();

        /*
         * Close the modal first.
         * Then let App handle finding and
         * scrolling to the marketplace card.
         */
        window.setTimeout(() => {
            onOpenProduct(productId);
        }, 120);
    };

    return (
        <div
            className={`modal my-orders-modal ${isOpen ? 'show' : ''
                }`}
            onClick={(event) => {
                if (
                    event.target.classList.contains(
                        'modal',
                    )
                ) {
                    onClose();
                }
            }}
        >
            <div className="modal-card my-orders-card">
                <button
                    className="close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close my orders"
                >
                    ×
                </button>

                <div className="my-orders-header">
                    <div className="eyebrow">
                        YOUR ORDERS
                    </div>

                    <h2>My orders.</h2>

                    <p>
                        Everything you've ordered
                        from the marketplace, in one
                        place.
                    </p>
                </div>

                {isLoading ? (
                    <div className="empty my-orders-empty">
                        Loading your orders...
                    </div>
                ) : error ? (
                    <div className="empty my-orders-empty">
                        {error}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty my-orders-empty">
                        You haven't placed an
                        order yet.
                    </div>
                ) : (
                    <div className="my-orders-list">
                        {orders.map((order) => (
                            <article
                                key={order.id}
                                className="my-order"
                            >
                                <div className="my-order-header">
                                    <div>
                                        <span className="my-order-kicker">
                                            ORDER
                                        </span>

                                        <h3>
                                            #{order.id}
                                        </h3>

                                        <time>
                                            {formatDate(
                                                order.createdAt,
                                            )}
                                        </time>
                                    </div>

                                    <div className="my-order-total">
                                        <span>TOTAL</span>

                                        <strong>
                                            {formatPrice(
                                                order.totalAmount,
                                            )}
                                        </strong>
                                    </div>
                                </div>

                                <div className="my-order-status-row">
                                    <strong>
                                        {STATUS_LABELS[
                                            order.status
                                        ] ||
                                            order.status}
                                    </strong>

                                    <span
                                        className={`my-order-status-pill ${String(
                                            order.status || '',
                                        ).toLowerCase()}`}
                                    >
                                        {order.status}
                                    </span>
                                </div>

                                <StatusTracker
                                    status={order.status}
                                />

                                <div className="my-order-products">
                                    <div className="my-order-products-heading">
                                        <span>
                                            ITEMS
                                        </span>

                                        <span>
                                            {order.items.length}{' '}
                                            {order.items.length ===
                                                1
                                                ? 'item'
                                                : 'items'}
                                        </span>
                                    </div>

                                    {order.items.map(
                                        (item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className="my-order-product"
                                                onClick={() =>
                                                    handleProductClick(
                                                        item.productId,
                                                    )
                                                }
                                            >
                                                <span className="my-order-product-art">
                                                    <span>
                                                        ↗
                                                    </span>
                                                </span>

                                                <span className="my-order-product-info">
                                                    <strong>
                                                        {
                                                            item.productName
                                                        }
                                                    </strong>

                                                    <small>
                                                        {item.sellerShopName ||
                                                            'Marketplace seller'}
                                                    </small>
                                                </span>

                                                <span className="my-order-product-quantity">
                                                    ×
                                                    {
                                                        item.quantity
                                                    }
                                                </span>

                                                <span className="my-order-product-price">
                                                    {formatPrice(
                                                        item.lineTotal,
                                                    )}
                                                </span>
                                            </button>
                                        ),
                                    )}
                                </div>

                                <div className="my-order-details">
                                    <div>
                                        <span>
                                            PAYMENT
                                        </span>

                                        <strong>
                                            {
                                                order.paymentMethod
                                            }{' '}
                                            ·{' '}
                                            {
                                                order.paymentStatus
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            DELIVERY
                                        </span>

                                        <strong>
                                            {
                                                order.deliveryLocation
                                            }
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}