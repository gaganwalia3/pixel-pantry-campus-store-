import React from 'react';

export default function ProductCard({
  product,
  onAddToCart,
}) {
  const formattedPrice =
    '₹' + product.price.toLocaleString('en-IN');

  const handleCardClick = () => {
    /*
     * The product card itself is intentionally
     * not a navigation link yet.
     *
     * My Orders uses the stable product ID on
     * this article to navigate back here.
     */
  };

  return (
    <article
      className="product"
      id={`product-${product.id}`}
      data-product-id={product.id}
      onClick={handleCardClick}
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
          ></div>
        )}
      </div>

      <div className="product-info">
        <span className="product-meta">
          {product.meta}
        </span>

        <h3>{product.name}</h3>

        <div className="product-bottom">
          <span className="price">
            {formattedPrice}
          </span>

          <button
            className="add"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddToCart(product);
            }}
            aria-label={`Add ${product.name} to bag`}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}