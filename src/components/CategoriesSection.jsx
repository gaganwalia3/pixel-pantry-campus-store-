import React from 'react';

export default function CategoriesSection({
  brands,
  onSelectBrand,
}) {
  return (
    <section id="categories">
      <div className="section-top">
        <div>
          <div className="eyebrow">
            Find your corner
          </div>

          <h2>Shop by brand</h2>
        </div>

        <a
          className="small-link"
          href="#catalog"
          onClick={() => onSelectBrand('')}
        >
          SEE EVERYTHING →
        </a>
      </div>

      <div className="categories">
        {brands.map((brand, index) => (
          <button
            key={brand.id}
            className="category"
            type="button"
            onClick={() =>
              onSelectBrand(brand.slug)
            }
          >
            <span className="cat-num">
              {String(index + 1).padStart(2, '0')} /
              BRAND
            </span>

            <span className="mini-pixel"></span>

            <h3>{brand.name}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}