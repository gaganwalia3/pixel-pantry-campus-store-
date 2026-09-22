const express = require('express');
const db = require('../db');

const router = express.Router();

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_SEARCH_LENGTH = 100;
const MAX_SLUG_LENGTH = 100;

const isValidLimit = (value) => {
    if (value === undefined) {
        return true;
    }

    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= MAX_LIMIT
    );
};

const isValidOffset = (value) => {
    if (value === undefined) {
        return true;
    }

    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number >= 0
    );
};

const cleanSearch = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .trim()
        .slice(0, MAX_SEARCH_LENGTH);
};

const cleanSlug = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .trim()
        .toLowerCase()
        .slice(0, MAX_SLUG_LENGTH);
};


/*
 * ============================================================
 * PUBLIC BRANDS
 * ============================================================
 *
 * Only active brands are publicly exposed.
 *
 * Seller/application/private information is never returned.
 */
router.get('/brands', async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT
                HEX(id) AS id,
                name,
                slug,
                description,
                logo_url
            FROM brands
            WHERE is_active = 1
            ORDER BY
                name ASC,
                id ASC
            `,
        );

        const brands = rows.map(
            (brand) => ({
                id:
                    brand.id.toLowerCase(),

                name:
                    brand.name,

                slug:
                    brand.slug,

                description:
                    brand.description,

                logoUrl:
                    brand.logo_url || null,
            }),
        );

        return res.json({
            success: true,
            brands,
        });
    } catch (error) {
        console.error(
            'Public brands fetch failed:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to load brands',
        });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT
                HEX(id) AS id,
                name,
                slug,
                description
            FROM categories
            WHERE is_active = 1
            ORDER BY
                name ASC,
                id ASC
            `,
        );

        const categories = rows.map(
            (category) => ({
                id:
                    category.id.toLowerCase(),

                name:
                    category.name,

                slug:
                    category.slug,

                description:
                    category.description,
            }),
        );

        return res.json({
            success: true,
            categories,
        });
    } catch (error) {
        console.error(
            'Public categories fetch failed:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to load categories',
        });
    }
});


/*
 * ============================================================
 * PUBLIC PRODUCTS
 * ============================================================
 */
router.get('/', async (req, res) => {
    try {
        const {
            category,
            brand,
            q,
            limit,
            offset,
        } = req.query;

        if (!isValidLimit(limit)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid limit',
            });
        }

        if (!isValidOffset(offset)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid offset',
            });
        }

        if (
            category !== undefined &&
            (
                typeof category !== 'string' ||
                category.length > MAX_SLUG_LENGTH
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category',
            });
        }

        if (
            brand !== undefined &&
            (
                typeof brand !== 'string' ||
                brand.length > MAX_SLUG_LENGTH
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid brand',
            });
        }

        const search = cleanSearch(q);
        const categorySlug = cleanSlug(category);
        const brandSlug = cleanSlug(brand);

        const parsedLimit =
            limit === undefined
                ? DEFAULT_LIMIT
                : Number(limit);

        const parsedOffset =
            offset === undefined
                ? 0
                : Number(offset);

        const conditions = [
            "p.status = 'ACTIVE'",
            "sp.status = 'ACTIVE'",
            "c.is_active = 1",
            "b.is_active = 1",
        ];

        const params = [];

        if (categorySlug) {
            conditions.push(
                'c.slug = ?',
            );

            params.push(
                categorySlug,
            );
        }

        if (brandSlug) {
            conditions.push(
                'b.slug = ?',
            );

            params.push(
                brandSlug,
            );
        }

        if (search) {
            conditions.push(`
                (
                    p.name LIKE ?
                    OR p.description LIKE ?
                    OR b.name LIKE ?
                    OR c.name LIKE ?
                    OR sp.shop_name LIKE ?
                )
            `);

            const searchPattern =
                `%${search}%`;

            params.push(
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern,
            );
        }

        const whereClause =
            conditions.join(' AND ');

        const [rows] = await db.query(
            `
            SELECT
                HEX(p.id) AS id,
                HEX(sp.id) AS seller_id,

                p.name,
                p.slug,
                p.description,
                p.price,
                p.status,

                HEX(c.id) AS category_id,
                c.name AS category_name,
                c.slug AS category_slug,

                HEX(b.id) AS brand_id,
                b.name AS brand_name,
                b.slug AS brand_slug,

                sp.shop_name,

                COALESCE(
                    pi.quantity,
                    0
                ) AS quantity,

                COALESCE(
                    pi.reserved_quantity,
                    0
                ) AS reserved_quantity,

                GREATEST(
                    COALESCE(pi.quantity, 0) -
                    COALESCE(pi.reserved_quantity, 0),
                    0
                ) AS available_quantity,

                /*
                 * Primary product image
                 */
                pim.image_url,
                pim.alt_text,
                pim.sort_order,
                pim.is_primary

            FROM products p

            INNER JOIN seller_profiles sp
                ON sp.id = p.seller_id

            INNER JOIN categories c
                ON c.id = p.category_id

            INNER JOIN brands b
                ON b.id = p.brand_id

            LEFT JOIN product_inventory pi
                ON pi.product_id = p.id

            LEFT JOIN product_images pim
                ON pim.product_id = p.id
                AND pim.is_primary = 1

            WHERE ${whereClause}

            ORDER BY
                p.created_at DESC,
                p.id DESC

            LIMIT ?
            OFFSET ?
            `,
            [
                ...params,
                parsedLimit,
                parsedOffset,
            ],
        );

        const products = rows.map(
            (product) => ({
                id:
                    product.id.toLowerCase(),

                sellerId:
                    product.seller_id.toLowerCase(),

                name:
                    product.name,

                slug:
                    product.slug,

                description:
                    product.description,

                price:
                    Number(product.price),

                status:
                    product.status,

                category: {
                    id:
                        product.category_id.toLowerCase(),

                    name:
                        product.category_name,

                    slug:
                        product.category_slug,
                },

                brand: {
                    id:
                        product.brand_id.toLowerCase(),

                    name:
                        product.brand_name,

                    slug:
                        product.brand_slug,
                },

                seller: {
                    id:
                        product.seller_id.toLowerCase(),

                    shopName:
                        product.shop_name,
                },

                inventory: {
                    quantity:
                        Number(
                            product.quantity,
                        ),

                    reservedQuantity:
                        Number(
                            product.reserved_quantity,
                        ),

                    availableQuantity:
                        Number(
                            product.available_quantity,
                        ),
                },

                /*
                 * Keep image data provider-agnostic.
                 */
                image:
                    product.image_url
                        ? {
                            imageUrl:
                                product.image_url,

                            altText:
                                product.alt_text,

                            sortOrder:
                                Number(
                                    product.sort_order,
                                ),

                            isPrimary:
                                Boolean(
                                    product.is_primary,
                                ),
                        }
                        : null,
            }),
        );

        return res.json({
            success: true,

            products,

            pagination: {
                limit:
                    parsedLimit,

                offset:
                    parsedOffset,

                count:
                    products.length,
            },
        });
    } catch (error) {
        console.error(
            'Public products fetch failed:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to load marketplace products',
        });
    }
});

module.exports = router;