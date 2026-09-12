import React from 'react';
import ProductCard from './ProductCard';

export default function CatalogSection({
  products,
  activeCategory,
  onSelectCategory,
  onAddToCart,
  onOpenRequest,
}) {
  const categories = [
    { label: 'All objects', value: 'All' },
    { label: 'Sound & tech', value: 'Audio' },
    { label: 'Home comforts', value: 'Home' },
    { label: 'Daily carry', value: 'Daily' },
    { label: 'Green living', value: 'Green' },
  ];

  const countText =
    products.length + ' OBJECT' + (products.length === 1 ? '' : 'S');

  return (
    <section className="catalog" id="catalog">
      <div className="section-top">
        <div>
          <div className="eyebrow">Shelf 001</div>
          <h2>Good things, gathered</h2>
        </div>
        <span className="small-link" id="productNumber">
          {countText}
        </span>
      </div>

      <div className="filters">
        {categories.map((cat) => (
          <button
            key={cat.value}
            className={`filter ${activeCategory === cat.value ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="products" id="products">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
          />
        ))}

        {products.length === 0 && (
          <div className="empty" id="empty" style={{ display: 'block' }}>
            Nothing on this shelf yet. Want us to source it?{' '}
            <button className="link-btn" onClick={onOpenRequest}>
              Request an item
            </button>
          </div>
        )}
      </div>

      <div className="request-card" id="request">
        <div>
          <h3>Something missing from the shelf?</h3>
          <p>
            Tell us what you’re looking for and our sourcing team will see what
            magic they can work.
          </p>
        </div>
        <button onClick={onOpenRequest}>REQUEST AN ITEM →</button>
      </div>
    </section>
  );
}
