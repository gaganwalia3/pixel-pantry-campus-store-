

-- ============================================================
-- 004_canonical_catalog_foundation.sql
--
-- Establishes:
--   1. Canonical public categories
--   2. Legacy catalog retirement
--   3. Strict 1:1 seller <-> brand ownership
--
-- Existing products and order history are preserved.
--
-- NOTE:
-- The first attempt at migration 004 partially executed before
-- failing on the pre-existing "Daily" category. Therefore this
-- migration is intentionally written to safely complete that
-- partial state.
-- ============================================================


-- ============================================================
-- 1. Verify / preserve seller <-> brand ownership table
--
-- The table was already created by the first migration attempt.
-- IF NOT EXISTS makes this completion migration safe against the
-- already-created table without changing its structure.
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_brands (
    seller_id BINARY(16) NOT NULL,
    brand_id BINARY(16) NOT NULL,

    created_at TIMESTAMP(6) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (seller_id),

    UNIQUE KEY uq_seller_brands_brand_id (brand_id),

    CONSTRAINT fk_seller_brands_seller
        FOREIGN KEY (seller_id)
        REFERENCES seller_profiles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_brands_brand
        FOREIGN KEY (brand_id)
        REFERENCES brands (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);


-- ============================================================
-- 2. Retire legacy categories
--
-- IMPORTANT:
-- "Daily" already exists and contains historical/test products.
-- It will be reused as the canonical Daily category.
--
-- Audio, Home and Green become inactive.
-- ============================================================

UPDATE categories
SET is_active = FALSE
WHERE slug IN (
    'audio',
    'home',
    'green'
);


-- ============================================================
-- 3. Reactivate the existing Daily row as the canonical Daily
-- category.
--
-- We deliberately reuse this row because products and historical
-- orders already reference it.
-- ============================================================

UPDATE categories
SET
    name = 'Daily',
    slug = 'daily',
    description =
        'Everyday products for campus life and daily routines.',
    is_active = TRUE
WHERE slug = 'daily';


-- ============================================================
-- 4. Retire the legacy/test brand
--
-- Existing products continue referencing this brand.
-- It is no longer selectable for new products.
-- ============================================================

UPDATE brands
SET is_active = FALSE
WHERE slug = 'unbranded-student-made';


-- ============================================================
-- 5. Create the remaining canonical categories.
--
-- Daily is intentionally excluded because the existing Daily
-- row is being reused above.
--
-- No INSERT IGNORE is used.
-- Unexpected duplicate data must fail loudly.
-- ============================================================

INSERT INTO categories (
    id,
    name,
    slug,
    description,
    is_active
)
VALUES
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Electronics',
    'electronics',
    'Phones, computers, gadgets, devices, and electronic accessories.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Clothing',
    'clothing',
    'Clothing, apparel, footwear, and fashion items.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Perfume',
    'perfume',
    'Perfumes, fragrances, body scents, and related products.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Handmade',
    'handmade',
    'Handcrafted, handmade, and student-created products.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Flowers',
    'flowers',
    'Flowers, bouquets, floral arrangements, and related products.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Toys',
    'toys',
    'Toys, games, collectibles, and recreational products.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Accessories',
    'accessories',
    'Bags, jewelry, wearable accessories, and related items.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Books',
    'books',
    'Books, textbooks, study material, and reading products.',
    TRUE
),
(
    UNHEX(REPLACE(UUID(), '-', '')),
    'Others',
    'others',
    'Products that do not fit another canonical category.',
    TRUE
);