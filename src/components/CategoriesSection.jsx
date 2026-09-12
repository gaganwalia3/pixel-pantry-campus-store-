import React from 'react';
import { CATEGORIES } from '../data/products';

export default function CategoriesSection({ onSelectCategory }) {
  return (
    <section id="categories">
      <div className="section-top">
        <div>
          <div className="eyebrow">Find your corner</div>
          <h2>Shop by mood</h2>
        </div>
        <a
          className="small-link"
          href="#catalog"
          onClick={() => onSelectCategory('All')}
        >
          SEE EVERYTHING →
        </a>
      </div>

      <div className="categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className="category"
            onClick={() => onSelectCategory(cat.catKey)}
          >
            <span className="cat-num">{cat.num}</span>
            <span className="mini-pixel"></span>
            <h3>{cat.title}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}
