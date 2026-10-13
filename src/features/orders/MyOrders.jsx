
import React, {
    useCallback,
    useEffect,
    useState,
} from 'react';

import { getCsrfToken } from '../auth/authStore';

const API_URL =
    import.meta.env.DEV
        ? 'http://localhost:5000'
        : '';

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
        Number(value).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

function formatDate(value) {
    if (!value) return '';

    return new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
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
                    <strong>Order cancelled</strong>
                    <p>This order will not be delivered.</p>
                </div>
            </div>
        );
    }

    const currentIndex = getStatusIndex(status);

    return (
        <div className="my-orders-tracker">
            {STATUS_STEPS.map((step, index) => {
                const isComplete = index <= currentIndex;

                return (
                    <div
                        key={step}
                        className={`my-orders-step ${isComplete ? 'complete' : ''
                            } ${index === currentIndex ? 'current' : ''
                            }`}
                    >
                        <span className="my-orders-step-dot">
                            {isComplete ? '✓' : index + 1}
                        </span>

                        <small>{STATUS_LABELS[step]}</small>
                    </div>
                );
            })}
        </div>
    );
}

function ReviewForm({
    item,
    eligibility,
    onSubmit,
}) {
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!eligibility) return null;

    if (eligibility.alreadyReviewed) {
        return (
            <div className="order-review-status">
                <span>✓</span> You've reviewed this product.
            </div>
        );
    }

    if (!eligibility.withinWindow) {
        return (
            <div className="order-review-status muted">
                The 7-day review period has ended.
            </div>
        );
    }

    if (!eligibility.canReview) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isSubmitting) return;

        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            await onSubmit({
                orderItemId: eligibility.orderItemId,
                rating,
                reviewText: reviewText.trim(),
            });

            setSuccess('Your review was submitted successfully.');
            setReviewText('');
        } catch (submitError) {
            setError(
                submitError.message ||
                'Unable to submit your review.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form
            className="order-review-form"
            onSubmit={handleSubmit}
        >
            <h4>Review this delivered item</h4>

            <div className="order-review-rating">
                <span>Rating</span>

                <div
                    className="order-review-stars"
                    role="group"
                    aria-label="Choose a rating from 1 to 5"
                >
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            className={
                                star <= rating ? 'selected' : ''
                            }
                            onClick={() => setRating(star)}
                            aria-label={`${star} star${star === 1 ? '' : 's'
                                }`}
                            aria-pressed={rating === star}
                        >
                            ★
                        </button>
                    ))}
                </div>

                <span className="order-review-rating-value">
                    {rating}/5
                </span>
            </div>

            <label
                className="order-review-label"
                htmlFor={`review-text-${eligibility.orderItemId}`}
            >
                Your review (optional)
            </label>

            <textarea
                id={`review-text-${eligibility.orderItemId}`}
                value={reviewText}
                onChange={(event) =>
                    setReviewText(event.target.value)
                }
                maxLength={2000}
                rows={3}
                placeholder="How was this product?"
                disabled={isSubmitting}
            />

            <div className="order-review-footer">
                <small>{reviewText.length}/2000 characters</small>

                <button
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? 'Submitting...'
                        : 'Submit review'}
                </button>
            </div>

            {error && (
                <p className="order-review-error" role="alert">
                    {error}
                </p>
            )}

            {success && (
                <p className="order-review-success" role="status">
                    {success}
                </p>
            )}
        </form>
    );
}

export default function MyOrders({
    isOpen,
    onClose,
    session,
    onOpenProduct,
}) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [reviewEligibility, setReviewEligibility] =
        useState({});

    const [eligibilityError, setEligibilityError] =
        useState('');

    const refreshReviewEligibility = useCallback(async () => {
        const response = await fetch(
            `${API_URL}/api/products/reviews/eligibility`,
            {
                method: 'GET',
                credentials: 'include',
            },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                'Unable to check review eligibility.',
            );
        }

        const nextEligibility = {};

        for (const item of data.items || []) {
            nextEligibility[item.orderItemId] = item;
        }

        setReviewEligibility(nextEligibility);
        setEligibilityError('');
    }, []);

    useEffect(() => {
        if (!isOpen || !session?.isAuthenticated) {
            return undefined;
        }

        let cancelled = false;

        const loadOrders = async () => {
            setIsLoading(true);
            setError('');

            try {
                const response = await fetch(
                    `${API_URL}/api/orders/my-orders`,
                    {
                        method: 'GET',
                        credentials: 'include',
                    },
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        'Unable to load your orders.',
                    );
                }

                if (!cancelled) {
                    setOrders(
                        Array.isArray(data.orders)
                            ? data.orders
                            : [],
                    );
                }
            } catch (requestError) {
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

        const loadEligibility = async () => {
            try {
                await refreshReviewEligibility();
            } catch (requestError) {
                if (!cancelled) {
                    setEligibilityError(
                        requestError.message ||
                        'Unable to load review eligibility.',
                    );
                }
            }
        };

        loadOrders();
        loadEligibility();

        return () => {
            cancelled = true;
        };
    }, [
        isOpen,
        session?.isAuthenticated,
        refreshReviewEligibility,
    ]);

    if (!isOpen) return null;

    const handleProductClick = (productId) => {
        onClose();

        window.setTimeout(() => {
            onOpenProduct?.(productId);
        }, 120);
    };

    const submitReview = async ({
        orderItemId,
        rating,
        reviewText,
    }) => {
        // Obtain a fresh token for this state-changing request.
        const csrfToken = await getCsrfToken();

        const response = await fetch(
            `${API_URL}/api/products/reviews`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    orderItemId,
                    rating,
                    reviewText,
                }),
            },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'Unable to submit your review.',
            );
        }

        // Refresh the server-authoritative eligibility state.
        await refreshReviewEligibility();
    };

    return (
        <div
            className={`modal my-orders-modal ${isOpen ? 'show' : ''
                }`}
            onClick={(event) => {
                if (
                    event.target.classList.contains('modal')
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
                    <div className="eyebrow">YOUR ORDERS</div>

                    <h2>My orders.</h2>

                    <p>
                        Everything you've ordered from the
                        marketplace, in one place.
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
                        You haven't placed an order yet.
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

                                        <h3>#{order.id}</h3>

                                        <time>
                                            {formatDate(order.createdAt)}
                                        </time>
                                    </div>

                                    <div className="my-order-total">
                                        <span>TOTAL</span>

                                        <strong>
                                            {formatPrice(order.totalAmount)}
                                        </strong>
                                    </div>
                                </div>

                                <div className="my-order-status-row">
                                    <strong>
                                        {STATUS_LABELS[order.status] ||
                                            order.status}
                                    </strong>

                                    <span
                                        className={`my-order-status-pill ${String(
                                            order.status || '',
                                        ).toLowerCase()
                                            }`}
                                    >
                                        {order.status}
                                    </span>
                                </div>

                                <StatusTracker status={order.status} />

                                <div className="my-order-products">
                                    <div className="my-order-products-heading">
                                        <span>ITEMS</span>

                                        <span>
                                            {order.items.length}{' '}
                                            {order.items.length === 1
                                                ? 'item'
                                                : 'items'}
                                        </span>
                                    </div>

                                    {order.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="my-order-review-item"
                                        >
                                            <button
                                                type="button"
                                                className="my-order-product"
                                                onClick={() =>
                                                    handleProductClick(
                                                        item.productId,
                                                    )
                                                }
                                            >
                                                <span className="my-order-product-art">
                                                    <span>↗</span>
                                                </span>

                                                <span className="my-order-product-info">
                                                    <strong>
                                                        {item.productName}
                                                    </strong>

                                                    <small>
                                                        {item.sellerShopName ||
                                                            'Marketplace seller'}
                                                    </small>
                                                </span>

                                                <span className="my-order-product-quantity">
                                                    ×{item.quantity}
                                                </span>

                                                <span className="my-order-product-price">
                                                    {formatPrice(
                                                        item.lineTotal,
                                                    )}
                                                </span>
                                            </button>

                                            {eligibilityError ? (
                                                <p className="order-review-note">
                                                    {eligibilityError}
                                                </p>
                                            ) : (
                                                <ReviewForm
                                                    item={item}
                                                    eligibility={
                                                        reviewEligibility[
                                                        item.id
                                                        ]
                                                    }
                                                    onSubmit={submitReview}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="my-order-details">
                                    <div>
                                        <span>PAYMENT</span>

                                        <strong>
                                            {order.paymentMethod} ·{' '}
                                            {order.paymentStatus}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>DELIVERY</span>

                                        <strong>
                                            {order.deliveryLocation}
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
