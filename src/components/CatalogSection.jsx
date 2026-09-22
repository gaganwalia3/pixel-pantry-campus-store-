import React from 'react';
import ProductCard from './ProductCard';

export default function CatalogSection({
  products,
  categories,
  activeCategory,
  onSelectCategory,
  onAddToCart,
  onOpenRequest,
}) {
  const countText =
    products.length +
    ' OBJECT' +
    (products.length === 1 ? '' : 'S');

  return (
    <section
      className="catalog"
      id="catalog"
    >
      <div className="section-top">
        <div>
          <div className="eyebrow">
            Shelf 001
          </div>

          <h2>
            Good things, gathered
          </h2>
        </div>

        <span
          className="small-link"
          id="productNumber"
        >
          {countText}
        </span>
      </div>

      <div className="filters">
        <button
          type="button"
          className={`filter ${activeCategory === ''
              ? 'active'
              : ''
            }`}
          onClick={() =>
            onSelectCategory('')
          }
        >
          All objects
        </button>

        {categories.map(
          (category) => (
            <button
              key={category.id}
              type="button"
              className={`filter ${activeCategory ===
                  category.slug
                  ? 'active'
                  : ''
                }`}
              onClick={() =>
                onSelectCategory(
                  category.slug,
                )
              }
            >
              {category.name}
            </button>
          ),
        )}
      </div>

      <div
        className="products"
        id="products"
      >
        {products.map(
          (product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={
                onAddToCart
              }
            />
          ),
        )}

        {products.length === 0 && (
          <div
            className="empty"
            id="empty"
            style={{
              display: 'block',
            }}
          >
            Nothing on this shelf yet. Want us to source it?{' '}
            <button
              className="link-btn"
              type="button"
              onClick={
                onOpenRequest
              }
            >
              Request an item
            </button>
          </div>
        )}
      </div>

      <div
        className="request-card"
        id="request"
      >
        <div>
          <h3>
            Something missing from
            the shelf?
          </h3>

          <p>
            Tell us what you’re looking
            for and our sourcing team
            will see what magic they
            can work.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onOpenRequest
          }
        >
          REQUEST AN ITEM →
        </button>
      </div>
    </section>
  );
}