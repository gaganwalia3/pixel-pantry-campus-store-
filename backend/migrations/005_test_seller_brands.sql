START TRANSACTION;

-- Create an active, seller-owned brand for the existing test seller:
-- Campus Test Shelf
INSERT INTO brands (
    id,
    name,
    slug,
    description,
    logo_url,
    is_active
)
SELECT
    UUID_TO_BIN(UUID()),
    'Campus Test Shelf',
    'campus-test-shelf',
    'Test seller brand for Campus Store development.',
    NULL,
    1
WHERE NOT EXISTS (
    SELECT 1
    FROM brands
    WHERE slug = 'campus-test-shelf'
);

-- Create an active, seller-owned brand for the existing test seller:
-- joybox
INSERT INTO brands (
    id,
    name,
    slug,
    description,
    logo_url,
    is_active
)
SELECT
    UUID_TO_BIN(UUID()),
    'joybox',
    'joybox',
    'Test seller brand for Campus Store development.',
    NULL,
    1
WHERE NOT EXISTS (
    SELECT 1
    FROM brands
    WHERE slug = 'joybox'
);

-- Link Campus Test Shelf seller to its new brand.
INSERT INTO seller_brands (
    seller_id,
    brand_id
)
SELECT
    sp.id,
    b.id
FROM seller_profiles sp
INNER JOIN brands b
    ON b.slug = 'campus-test-shelf'
WHERE sp.shop_name = 'Campus Test Shelf'
  AND b.is_active = 1
  AND NOT EXISTS (
      SELECT 1
      FROM seller_brands sb
      WHERE sb.seller_id = sp.id
  );

-- Link joybox seller to its new brand.
INSERT INTO seller_brands (
    seller_id,
    brand_id
)
SELECT
    sp.id,
    b.id
FROM seller_profiles sp
INNER JOIN brands b
    ON b.slug = 'joybox'
WHERE sp.shop_name = 'joybox'
  AND b.is_active = 1
  AND NOT EXISTS (
      SELECT 1
      FROM seller_brands sb
      WHERE sb.seller_id = sp.id
  );

COMMIT;