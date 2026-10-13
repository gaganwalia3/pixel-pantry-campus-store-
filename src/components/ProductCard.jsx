
import React from 'react';

export default function ProductCard({
  product,
  onAddToCart,
  onOpenProductDetails,
}) {
  const formattedPrice =
    '₹' +
    Number(product.price).toLocaleString('en-IN');

  const averageRating = Number(product.averageRating || 0);
  const reviewCount = Number(product.reviewCount || 0);

  return (
    <article
      className="product"
      id={`product-${product.id}`}
      data-product-id={product.id}
    >
      <button
        type="button"
        className="product-details-trigger"
        onClick={() =>
          onOpenProductDetails?.(product)
        }
        aria-label={`View details for ${product.name}`}
      >
        <div className="product-art">
          {product.image?.imageUrl ? (
            <img
              className="product-image"
              src={product.image.imageUrl}
              alt={
                product.image.altText ||
                product.name
              }
            />
          ) : (
            <div
              className={`product-icon ${product.iconClass || ''}`}
              style={product.iconStyle || {}}
            />
          )}
        </div>

        <div className="product-info">
          <span className="product-meta">
            {product.category?.name ||
              'Campus essentials'}
          </span>

          <h3>{product.name}</h3>

          <div
            className="product-rating"
            aria-label={
              reviewCount > 0
                ? `${averageRating.toFixed(1)} out of 5 stars, ${reviewCount} reviews`
                : 'No reviews available'
            }
          >
            {reviewCount > 0 ? (
              <>
                <span className="product-rating-star">
                  ★
                </span>
                <span>
                  {averageRating.toFixed(1)}
                </span>
                <span className="product-rating-count">
                  · {reviewCount}{' '}
                  {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </>
            ) : (
              <span className="product-no-reviews">
                No Reviews
              </span>
            )}
          </div>

          <span className="product-view-link">
            VIEW DETAILS →
          </span>
        </div>
      </button>

      <div className="product-bottom">
        <span className="price">
          {formattedPrice}
        </span>

        <button
          className="add"
          type="button"
          onClick={() => onAddToCart(product)}
          aria-label={`Add ${product.name} to bag`}
        >
          +
        </button>
      </div>
    </article>
  );
}
