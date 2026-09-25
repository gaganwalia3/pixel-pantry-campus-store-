import React, { useState } from 'react';

export default function HeroSection({
  onSearch,
  onOpenRequest,
}) {
  const [query, setQuery] = useState('');

  const scrollToCatalog = () => {
    const catalogElement = document.getElementById('catalog');

    if (catalogElement) {
      catalogElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSearch(query);
    scrollToCatalog();
  };

  return (
    <section className="hero" id="home">
      <div className="hero-copy">
        <div className="hero-eyebrow">
          CAMPUS MARKETPLACE
        </div>

        <h1>
          Your own
          <br />
          <span>super store</span>
        </h1>

        <p>
          Shop daily essentials, college favourites and
          unique finds from students, for students.
        </p>

        <form
          className="hero-search"
          onSubmit={handleSubmit}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>

          <input
            id="searchInput"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search for snacks, stationery, apparel and more..."
            aria-label="Search the catalogue"
          />

          <button type="submit">
            Search
          </button>
        </form>

        <div className="hero-actions">
          <button
            type="button"
            className="hero-primary-button"
            onClick={scrollToCatalog}
          >
            Shop now
            <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className="hero-secondary-button"
            onClick={onOpenRequest}
          >
            Request a product
          </button>
        </div>
      </div>

      <div className="hero-art" aria-hidden="true">
        <img
          className="hero-store-image"
          src="/super-daily-store-transparent-16.png"
          alt=""
          draggable="false"
        />
      </div>
    </section>
  );
}