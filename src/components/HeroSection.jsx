import React, { useState } from 'react';

export default function HeroSection({ onSearch, onOpenRequest }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
    const catalogEl = document.getElementById('catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero" id="home">
      <div>
        <div className="eyebrow">The everyday edit · 01</div>
        <h1>
          Small things.<br />
          <em>Big feeling.</em>
        </h1>
        <p>
          A calmer way to find the objects that make your daily rhythm feel more
          like you. Consider this your very good-looking corner shop.
        </p>

        <form className="search" onSubmit={handleSubmit}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="6"></circle>
            <path d="m20 20-4.2-4.2"></path>
          </svg>
          <input
            id="searchInput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find something lovely…"
            aria-label="Search the catalogue"
          />
          <button type="submit">Search</button>
        </form>

        <div className="hero-actions">
          <a className="link-btn" href="#catalog">
            Explore collection ↓
          </a>
          <button className="link-btn" onClick={onOpenRequest}>
            Can’t find it?
          </button>
        </div>
      </div>

      <div className="pixel-scene" aria-label="Pixel-art shopping bag illustration">
        <div className="checker"></div>
        <div className="pixel spark one"></div>
        <div className="pixel spark two"></div>
        <div className="pixel pixel-hand"></div>
        <div className="pixel pixel-bag"></div>
      </div>
    </section>
  );
}
