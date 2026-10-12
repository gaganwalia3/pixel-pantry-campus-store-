
import React from 'react';

export default function ProductCard({
  product,
  onAddToCart,
  onOpenProductDetails,
}) {
  const formattedPrice =
    '₹' +
    Number(product.price).toLocaleString('en-IN');

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
              className={`product-icon ${product.iconClass || ''
                }`}
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