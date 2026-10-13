
import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.DEV
    ? 'http://localhost:5000'
    : '';

export default function ProductDetailsModal({
    product,
    onClose,
    onAddToCart,
}) {
    const [reviews, setReviews] = useState([]);
    const [reviewSummary, setReviewSummary] = useState({
        averageRating: 0,
        reviewCount: 0,
    });
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsError, setReviewsError] = useState('');

    useEffect(() => {
        if (!product) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [product, onClose]);

    useEffect(() => {
        if (!product?.id) return undefined;

        const controller = new AbortController();

        const loadReviews = async () => {
            setReviewsLoading(true);
            setReviewsError('');
            setReviews([]);
            setReviewSummary({
                averageRating: 0,
                reviewCount: 0,
            });

            try {
                const response = await fetch(
                    `${API_URL}/api/products/${encodeURIComponent(product.id)}/reviews`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    },
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || 'Unable to load reviews.',
                    );
                }

                setReviews(
                    Array.isArray(data.reviews)
                        ? data.reviews
                        : [],
                );

                setReviewSummary({
                    averageRating: Number(
                        data.summary?.averageRating || 0,
                    ),
                    reviewCount: Number(
                        data.summary?.reviewCount || 0,
                    ),
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setReviewsError(
                        error.message || 'Unable to load reviews.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setReviewsLoading(false);
                }
            }
        };

        loadReviews();

        return () => controller.abort();
    }, [product?.id]);

    if (!product) return null;

    const price = Number(product.price);

    const formattedPrice = Number.isFinite(price)
        ? '₹' + price.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
        : 'Price unavailable';

    const sellerName =
        product.seller?.shopName || 'Campus Store seller';

    const description =
        typeof product.description === 'string' &&
            product.description.trim()
            ? product.description
            : 'No description is available for this product yet.';

    const availableQuantity = Number(
        product.inventory?.availableQuantity ??
        product.stock ??
        0,
    );

    const isAvailable =
        Number.isFinite(availableQuantity) &&
        availableQuantity > 0 &&
        Number.isFinite(price) &&
        price >= 0;

    const handleAddToCart = () => {
        onAddToCart(product);
    };

    const formatReviewDate = (value) => {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div
            className="modal show"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                className="modal-card product-details-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-details-title"
                aria-describedby="product-details-description"
            >
                <button
                    className="close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close product details"
                >
                    ×
                </button>

                <div className="product-details-content">
                    <div className="product-details-image">
                        {product.image?.imageUrl ? (
                            <img
                                src={product.image.imageUrl}
                                alt={
                                    product.image.altText ||
                                    product.name
                                }
                                loading="lazy"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div
                                className={`product-icon ${product.iconClass || ''}`}
                                style={product.iconStyle || {}}
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <div className="product-details-info">
                        <span className="product-meta">
                            {product.category?.name ||
                                'Campus essentials'}
                        </span>

                        <h2 id="product-details-title">
                            {product.name}
                        </h2>

                        <p className="product-details-price">
                            {formattedPrice}
                        </p>

                        <div className="product-details-divider" />

                        <h3>About this product</h3>

                        <p id="product-details-description">
                            {description}
                        </p>

                        <div className="product-details-seller">
                            <span className="product-meta">
                                SOLD BY
                            </span>
                            <p>{sellerName}</p>
                        </div>

                        <p className="product-details-stock">
                            {isAvailable
                                ? 'Available to order'
                                : 'Currently unavailable'}
                        </p>

                        <button
                            className="primary"
                            type="button"
                            onClick={handleAddToCart}
                            disabled={!isAvailable}
                        >
                            {isAvailable
                                ? 'ADD TO BAG →'
                                : 'OUT OF STOCK'}
                        </button>
                    </div>
                </div>

                <section
                    className="product-reviews-section"
                    aria-labelledby="product-reviews-title"
                >
                    <div className="product-reviews-heading">
                        <div>
                            <span className="product-meta">
                                CUSTOMER FEEDBACK
                            </span>

                            <h3 id="product-reviews-title">
                                Reviews
                            </h3>
                        </div>

                        {!reviewsLoading && !reviewsError &&
                            reviewSummary.reviewCount > 0 && (
                                <div className="product-reviews-summary">
                                    <span className="product-rating-star">
                                        ★
                                    </span>
                                    <strong>
                                        {reviewSummary.averageRating.toFixed(1)}
                                    </strong>
                                    <span>
                                        ({reviewSummary.reviewCount}{' '}
                                        {reviewSummary.reviewCount === 1
                                            ? 'review'
                                            : 'reviews'})
                                    </span>
                                </div>
                            )}
                    </div>

                    {reviewsLoading && (
                        <p className="product-reviews-message">
                            Loading reviews...
                        </p>
                    )}

                    {!reviewsLoading && reviewsError && (
                        <div className="product-reviews-message">
                            <p>{reviewsError}</p>
                            <button
                                type="button"
                                className="product-reviews-retry"
                                onClick={() => {
                                    setReviewsError('');
                                    setReviewsLoading(true);

                                    fetch(
                                        `${API_URL}/api/products/${encodeURIComponent(product.id)}/reviews`,
                                        { credentials: 'include' },
                                    )
                                        .then(async (response) => {
                                            const data = await response.json();

                                            if (!response.ok || !data.success) {
                                                throw new Error(
                                                    data.message ||
                                                    'Unable to load reviews.',
                                                );
                                            }

                                            setReviews(
                                                Array.isArray(data.reviews)
                                                    ? data.reviews
                                                    : [],
                                            );

                                            setReviewSummary({
                                                averageRating: Number(
                                                    data.summary?.averageRating || 0,
                                                ),
                                                reviewCount: Number(
                                                    data.summary?.reviewCount || 0,
                                                ),
                                            });
                                        })
                                        .catch((error) => {
                                            setReviewsError(
                                                error.message ||
                                                'Unable to load reviews.',
                                            );
                                        })
                                        .finally(() => {
                                            setReviewsLoading(false);
                                        });
                                }}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {!reviewsLoading &&
                        !reviewsError &&
                        reviews.length === 0 && (
                            <p className="product-reviews-message">
                                No reviews available yet. Be the first
                                to share your experience after purchasing
                                and receiving this product.
                            </p>
                        )}

                    {!reviewsLoading && !reviewsError &&
                        reviews.length > 0 && (
                            <div className="product-reviews-list">
                                {reviews.map((review) => (
                                    <article
                                        className="product-review"
                                        key={review.id}
                                    >
                                        <div className="product-review-top">
                                            <strong>
                                                {review.reviewerName ||
                                                    'Verified customer'}
                                            </strong>

                                            {review.createdAt && (
                                                <time>
                                                    {formatReviewDate(
                                                        review.createdAt,
                                                    )}
                                                </time>
                                            )}
                                        </div>

                                        <div
                                            className="product-review-stars"
                                            aria-label={`${review.rating} out of 5 stars`}
                                        >
                                            {'★'.repeat(
                                                Math.max(
                                                    0,
                                                    Math.min(
                                                        5,
                                                        Number(review.rating) || 0,
                                                    ),
                                                ),
                                            )}
                                            <span>
                                                {'★'.repeat(
                                                    5 - Math.max(
                                                        0,
                                                        Math.min(
                                                            5,
                                                            Number(review.rating) || 0,
                                                        ),
                                                    ),
                                                )}
                                            </span>
                                        </div>

                                        {review.reviewText && (
                                            <p className="product-review-text">
                                                {review.reviewText}
                                            </p>
                                        )}

                                        <span className="product-review-verified">
                                            ✓ Verified purchase
                                        </span>
                                    </article>
                                ))}
                            </div>
                        )}
                </section>
            </section>
        </div>
    );
}
