const crypto = require('crypto');
const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const {
    sellerProductRateLimiter,
} = require('../middleware/rateLimit');
const db = require('../db');
const cloudinary = require('../config/cloudinary');
const {
    imageUpload,
    validateImageMagicBytes,
} = require('../middleware/upload');

const router = express.Router();

router.use(
    requireAuth,
    requireRole('SELLER'),
);

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PRICE = 99999999.99;
const MAX_STOCK = 4294967295;

const isValidId = (value) => {
    return (
        typeof value === 'string' &&
        /^[0-9a-fA-F]{32}$/.test(value)
    );
};

const isValidProductName = (value) => {
    return (
        typeof value === 'string' &&
        value.trim().length >= 2 &&
        value.trim().length <= MAX_NAME_LENGTH
    );
};

const isValidDescription = (value) => {
    return (
        typeof value === 'string' &&
        value.trim().length <=
        MAX_DESCRIPTION_LENGTH
    );
};

const isValidPrice = (value) => {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= MAX_PRICE &&
        Number.isInteger(
            Math.round(value * 100),
        )
    );
};

const isValidStock = (value) => {
    return (
        Number.isInteger(value) &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= MAX_STOCK
    );
};

const createProductSlug = (
    name,
    productId,
) => {
    const slugBase = name
        .toLowerCase()
        .normalize('NFKD')
        .replace(
            /[\u0300-\u036f]/g,
            '',
        )
        .replace(
            /[^a-z0-9]+/g,
            '-',
        )
        .replace(
            /^-+|-+$/g,
            '',
        );

    if (!slugBase) {
        return null;
    }

    return `${slugBase}-${productId
        .toString('hex')
        .slice(0, 8)}`;
};


/* =========================================================
   PRODUCT OPTIONS
   ========================================================= */

router.get(
    '/options',
    async (req, res) => {
        try {
            const [categories] =
                await db.execute(
                    `SELECT
                        id,
                        name,
                        slug,
                        description
                     FROM categories
                     WHERE is_active = 1
                     ORDER BY name ASC`,
                );

            const [brands] =
                await db.execute(
                    `SELECT
                        id,
                        name,
                        slug,
                        description,
                        logo_url
                     FROM brands
                     WHERE is_active = 1
                     ORDER BY name ASC`,
                );

            return res.json({
                success: true,

                categories:
                    categories.map(
                        (category) => ({
                            id: category.id.toString(
                                'hex',
                            ),

                            name:
                                category.name,

                            slug:
                                category.slug,

                            description:
                                category.description,
                        }),
                    ),

                brands:
                    brands.map(
                        (brand) => ({
                            id: brand.id.toString(
                                'hex',
                            ),

                            name:
                                brand.name,

                            slug:
                                brand.slug,

                            description:
                                brand.description,

                            logoUrl:
                                brand.logo_url,
                        }),
                    ),
            });
        } catch (error) {
            console.error(
                'Seller product options lookup error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to retrieve product options',
            });
        }
    },
);


/* =========================================================
   SELLER PRODUCT LIST
   ========================================================= */

router.get(
    '/',
    async (req, res) => {
        try {
            const sellerUserId =
                Buffer.from(
                    req.user.id,
                    'hex',
                );

            const [
                sellerProfiles,
            ] = await db.execute(
                `SELECT
                    id,
                    status
                 FROM seller_profiles
                 WHERE user_id = ?
                 LIMIT 1`,
                [sellerUserId],
            );

            if (
                sellerProfiles.length ===
                0
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found',
                });
            }

            const sellerProfile =
                sellerProfiles[0];

            if (
                sellerProfile.status !==
                'ACTIVE'
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Seller account is not active',
                });
            }

            const [products] =
                await db.execute(
                    `SELECT
                        p.id,
                        p.name,
                        p.slug,
                        p.description,
                        p.price,
                        p.status,
                        p.created_at,
                        p.updated_at,

                        c.id AS category_id,
                        c.name AS category_name,

                        b.id AS brand_id,
                        b.name AS brand_name,

                        COALESCE(
                            pi.quantity,
                            0
                        ) AS quantity,

                        COALESCE(
                            pi.reserved_quantity,
                            0
                        ) AS reserved_quantity,

                        pim.image_url,
                        pim.alt_text,
                        pim.sort_order,
                        pim.is_primary

                     FROM products p

                     INNER JOIN categories c
                        ON c.id =
                           p.category_id

                     INNER JOIN brands b
                        ON b.id =
                           p.brand_id

                     LEFT JOIN product_inventory pi
                        ON pi.product_id =
                           p.id

                     LEFT JOIN product_images pim
                        ON pim.product_id =
                           p.id
                        AND pim.is_primary = 1

                     WHERE p.seller_id = ?

                     ORDER BY
                        CASE
                            WHEN p.status =
                                'DRAFT'
                                THEN 0

                            WHEN p.status =
                                'ACTIVE'
                                THEN 1

                            ELSE 2
                        END,

                        p.created_at DESC`,
                    [sellerProfile.id],
                );

            return res.json({
                success: true,

                products:
                    products.map(
                        (product) => ({
                            id: product.id.toString(
                                'hex',
                            ),

                            name:
                                product.name,

                            slug:
                                product.slug,

                            description:
                                product.description,

                            price: Number(
                                product.price,
                            ),

                            status:
                                product.status,

                            category: {
                                id:
                                    product.category_id.toString(
                                        'hex',
                                    ),

                                name:
                                    product.category_name,
                            },

                            brand: {
                                id:
                                    product.brand_id.toString(
                                        'hex',
                                    ),

                                name:
                                    product.brand_name,
                            },

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
                                        product.quantity,
                                    ) -
                                    Number(
                                        product.reserved_quantity,
                                    ),
                            },

                            createdAt:
                                product.created_at,

                            updatedAt:
                                product.updated_at,
                        }),
                    ),
            });
        } catch (error) {
            console.error(
                'Seller product lookup error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to retrieve seller products',
            });
        }
    },
);


/* =========================================================
   CREATE SELLER PRODUCT
   ========================================================= */

router.post(
    '/',
    sellerProductRateLimiter,
    async (req, res) => {
        let connection;

        try {
            const {
                name,
                description,
                price,
                categoryId,
                brandId,
                stock,
            } = req.body;

            if (
                !isValidProductName(
                    name,
                ) ||
                !isValidDescription(
                    description,
                ) ||
                !isValidId(
                    categoryId,
                ) ||
                !isValidId(
                    brandId,
                ) ||
                !isValidPrice(
                    price,
                ) ||
                !isValidStock(
                    stock,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid product information',
                });
            }

            const trimmedName =
                name.trim();

            const trimmedDescription =
                description.trim();

            const normalizedPrice =
                Math.round(
                    price * 100,
                ) / 100;

            const sellerUserId =
                Buffer.from(
                    req.user.id,
                    'hex',
                );

            const categoryBuffer =
                Buffer.from(
                    categoryId,
                    'hex',
                );

            const brandBuffer =
                Buffer.from(
                    brandId,
                    'hex',
                );

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            const [
                sellerProfiles,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        status
                     FROM seller_profiles
                     WHERE user_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [sellerUserId],
                );

            if (
                sellerProfiles.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found',
                });
            }

            const sellerProfile =
                sellerProfiles[0];

            if (
                sellerProfile.status !==
                'ACTIVE'
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller account is not active',
                });
            }

            const [categories] =
                await connection.execute(
                    `SELECT id
                     FROM categories
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [categoryBuffer],
                );

            if (
                categories.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid or inactive category',
                });
            }

            const [brands] =
                await connection.execute(
                    `SELECT id
                     FROM brands
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [brandBuffer],
                );

            if (
                brands.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid or inactive brand',
                });
            }

            const productId =
                Buffer.from(
                    crypto
                        .randomUUID()
                        .replace(
                            /-/g,
                            '',
                        ),
                    'hex',
                );

            const slug =
                createProductSlug(
                    trimmedName,
                    productId,
                );

            if (!slug) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product name must contain letters or numbers',
                });
            }

            await connection.execute(
                `INSERT INTO products (
                    id,
                    seller_id,
                    brand_id,
                    category_id,
                    name,
                    slug,
                    description,
                    price,
                    status
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'DRAFT'
                )`,
                [
                    productId,
                    sellerProfile.id,
                    brandBuffer,
                    categoryBuffer,
                    trimmedName,
                    slug,
                    trimmedDescription ||
                    null,
                    normalizedPrice,
                ],
            );

            const inventoryId =
                Buffer.from(
                    crypto
                        .randomUUID()
                        .replace(
                            /-/g,
                            '',
                        ),
                    'hex',
                );

            await connection.execute(
                `INSERT INTO product_inventory (
                    id,
                    product_id,
                    quantity,
                    reserved_quantity
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    0
                )`,
                [
                    inventoryId,
                    productId,
                    stock,
                ],
            );

            await connection.commit();

            return res.status(201).json({
                success: true,
                message:
                    'Product created as draft',

                product: {
                    id: productId.toString(
                        'hex',
                    ),

                    sellerId:
                        sellerProfile.id.toString(
                            'hex',
                        ),

                    name:
                        trimmedName,

                    slug,

                    description:
                        trimmedDescription ||
                        null,

                    price:
                        normalizedPrice,

                    stock,

                    status:
                        'DRAFT',
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Seller product rollback error:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Seller product creation error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to create product',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);


/* =========================================================
   UPLOAD SELLER PRODUCT IMAGE
   ========================================================= */

router.post(
    '/:id/images',
    sellerProductRateLimiter,
    imageUpload.single('image'),
    validateImageMagicBytes,
    async (req, res) => {
        let connection;
        let uploadedPublicId = null;

        try {
            const productIdValue =
                req.params.id;

            if (
                !isValidId(
                    productIdValue,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid product id',
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Product image is required',
                });
            }

            const productId =
                Buffer.from(
                    productIdValue,
                    'hex',
                );

            const sellerUserId =
                Buffer.from(
                    req.user.id,
                    'hex',
                );

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            /*
             * Resolve seller identity from the
             * authenticated session.
             */
            const [
                sellerProfiles,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        status
                     FROM seller_profiles
                     WHERE user_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [sellerUserId],
                );

            if (
                sellerProfiles.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found',
                });
            }

            const sellerProfile =
                sellerProfiles[0];

            if (
                sellerProfile.status !==
                'ACTIVE'
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller account is not active',
                });
            }

            /*
             * Lock the product and verify that
             * THIS authenticated seller owns it.
             */
            const [products] =
                await connection.execute(
                    `SELECT
                        id,
                        seller_id,
                        status
                     FROM products
                     WHERE id = ?
                       AND seller_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [
                        productId,
                        sellerProfile.id,
                    ],
                );

            if (
                products.length ===
                0
            ) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Product not found',
                });
            }

            /*
             * Initial launch: one image per product.
             */
            const [
                existingImages,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        image_url
                     FROM product_images
                     WHERE product_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [productId],
                );

            if (
                existingImages.length >
                0
            ) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'This product already has an image',
                });
            }

            /*
             * Upload to Cloudinary.
             *
             * The image never gets permanently stored
             * on our backend server.
             */
            const uploadResult =
                await new Promise(
                    (
                        resolve,
                        reject,
                    ) => {
                        const uploadStream =
                            cloudinary.uploader.upload_stream(
                                {
                                    folder:
                                        `campus-store/products/${productIdValue}`,

                                    resource_type:
                                        'image',

                                    use_filename:
                                        false,

                                    unique_filename:
                                        true,

                                    overwrite:
                                        false,
                                },
                                (
                                    error,
                                    result,
                                ) => {
                                    if (
                                        error
                                    ) {
                                        reject(
                                            error,
                                        );
                                        return;
                                    }

                                    resolve(
                                        result,
                                    );
                                },
                            );

                        uploadStream.end(
                            req.file.buffer,
                        );
                    },
                );

            uploadedPublicId =
                uploadResult.public_id;

            /*
             * Save only the Cloudinary URL and
             * relevant metadata in our database.
             */
            const imageId =
                Buffer.from(
                    crypto
                        .randomUUID()
                        .replace(
                            /-/g,
                            '',
                        ),
                    'hex',
                );

            await connection.execute(
                `INSERT INTO product_images (
                    id,
                    product_id,
                    image_url,
                    alt_text,
                    sort_order,
                    is_primary
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    1
                )`,
                [
                    imageId,
                    productId,
                    uploadResult.secure_url,
                    null,
                ],
            );

            await connection.commit();

            return res.status(201).json({
                success: true,
                message:
                    'Product image uploaded successfully',

                image: {
                    id:
                        imageId.toString(
                            'hex',
                        ),

                    productId:
                        productId.toString(
                            'hex',
                        ),

                    imageUrl:
                        uploadResult.secure_url,

                    sortOrder: 0,

                    isPrimary: true,
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Product image rollback error:',
                        rollbackError,
                    );
                }
            }

            /*
             * If Cloudinary succeeded but the database
             * operation failed, remove the orphaned
             * Cloudinary asset.
             */
            if (
                uploadedPublicId
            ) {
                try {
                    await cloudinary.uploader.destroy(
                        uploadedPublicId,
                        {
                            resource_type:
                                'image',
                        },
                    );
                } catch (
                cleanupError
                ) {
                    console.error(
                        'Cloudinary orphan cleanup error:',
                        cleanupError,
                    );
                }
            }

            console.error(
                'Seller product image upload error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to upload product image',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);


/* =========================================================
   UPDATE SELLER PRODUCT
   ========================================================= */

router.patch(
    '/:id',
    sellerProductRateLimiter,
    async (req, res) => {
        let connection;

        try {
            const productIdValue =
                req.params.id;

            if (
                !isValidId(
                    productIdValue,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid product id',
                });
            }

            const {
                name,
                description,
                price,
                categoryId,
                brandId,
                stock,
            } = req.body;

            if (
                !isValidProductName(
                    name,
                ) ||
                !isValidDescription(
                    description,
                ) ||
                !isValidId(
                    categoryId,
                ) ||
                !isValidId(
                    brandId,
                ) ||
                !isValidPrice(
                    price,
                ) ||
                !isValidStock(
                    stock,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid product information',
                });
            }

            const trimmedName =
                name.trim();

            const trimmedDescription =
                description.trim();

            const normalizedPrice =
                Math.round(
                    price * 100,
                ) / 100;

            const productId =
                Buffer.from(
                    productIdValue,
                    'hex',
                );

            const sellerUserId =
                Buffer.from(
                    req.user.id,
                    'hex',
                );

            const categoryBuffer =
                Buffer.from(
                    categoryId,
                    'hex',
                );

            const brandBuffer =
                Buffer.from(
                    brandId,
                    'hex',
                );

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            /*
             * Resolve seller identity from the
             * authenticated session.
             */
            const [
                sellerProfiles,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        status
                     FROM seller_profiles
                     WHERE user_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [sellerUserId],
                );

            if (
                sellerProfiles.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found',
                });
            }

            const sellerProfile =
                sellerProfiles[0];

            if (
                sellerProfile.status !==
                'ACTIVE'
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller account is not active',
                });
            }

            /*
             * Lock the product row and verify
             * ownership using the seller profile
             * resolved above.
             */
            const [products] =
                await connection.execute(
                    `SELECT
                        id,
                        seller_id,
                        status
                     FROM products
                     WHERE id = ?
                       AND seller_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [
                        productId,
                        sellerProfile.id,
                    ],
                );

            if (
                products.length ===
                0
            ) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Product not found',
                });
            }

            /*
             * Category must still be active.
             */
            const [categories] =
                await connection.execute(
                    `SELECT id
                     FROM categories
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [categoryBuffer],
                );

            if (
                categories.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid or inactive category',
                });
            }

            /*
             * Brand must still be active.
             */
            const [brands] =
                await connection.execute(
                    `SELECT id
                     FROM brands
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [brandBuffer],
                );

            if (
                brands.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid or inactive brand',
                });
            }

            const slug =
                createProductSlug(
                    trimmedName,
                    productId,
                );

            if (!slug) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product name must contain letters or numbers',
                });
            }

            /*
             * Update product details.
             *
             * IMPORTANT:
             * status is deliberately NOT included.
             * Publishing/archiving will use dedicated
             * endpoints later.
             */
            await connection.execute(
                `UPDATE products
                 SET
                    brand_id = ?,
                    category_id = ?,
                    name = ?,
                    slug = ?,
                    description = ?,
                    price = ?
                 WHERE id = ?
                   AND seller_id = ?`,
                [
                    brandBuffer,
                    categoryBuffer,
                    trimmedName,
                    slug,
                    trimmedDescription ||
                    null,
                    normalizedPrice,
                    productId,
                    sellerProfile.id,
                ],
            );

            /*
             * Lock the inventory row.
             */
            const [
                inventoryRows,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        quantity,
                        reserved_quantity
                     FROM product_inventory
                     WHERE product_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [productId],
                );

            if (
                inventoryRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'Product inventory record not found',
                });
            }

            const inventory =
                inventoryRows[0];

            /*
             * Never allow available stock to
             * become negative.
             *
             * quantity must remain >=
             * reserved_quantity.
             */
            if (
                stock <
                Number(
                    inventory.reserved_quantity,
                )
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Stock cannot be lower than the currently reserved quantity (${Number(
                            inventory.reserved_quantity,
                        )})`,
                });
            }

            await connection.execute(
                `UPDATE product_inventory
                 SET
                    quantity = ?
                 WHERE product_id = ?`,
                [
                    stock,
                    productId,
                ],
            );

            await connection.commit();

            return res.json({
                success: true,
                message:
                    'Product updated successfully',

                product: {
                    id:
                        productId.toString(
                            'hex',
                        ),

                    name:
                        trimmedName,

                    slug,

                    description:
                        trimmedDescription ||
                        null,

                    price:
                        normalizedPrice,

                    categoryId:
                        categoryBuffer.toString(
                            'hex',
                        ),

                    brandId:
                        brandBuffer.toString(
                            'hex',
                        ),

                    stock,
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Seller product update rollback error:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Seller product update error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to update product',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);


/* =========================================================
   PUBLISH SELLER PRODUCT
   ========================================================= */

router.patch(
    '/:id/publish',
    sellerProductRateLimiter,
    async (req, res) => {
        let connection;

        try {
            const productIdValue =
                req.params.id;

            if (
                !isValidId(
                    productIdValue,
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid product id',
                });
            }

            const productId =
                Buffer.from(
                    productIdValue,
                    'hex',
                );

            const sellerUserId =
                Buffer.from(
                    req.user.id,
                    'hex',
                );

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            /*
             * Resolve seller from the authenticated
             * session. Never trust a seller ID
             * supplied by the frontend.
             */
            const [
                sellerProfiles,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        status
                     FROM seller_profiles
                     WHERE user_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [sellerUserId],
                );

            if (
                sellerProfiles.length ===
                0
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller profile not found',
                });
            }

            const sellerProfile =
                sellerProfiles[0];

            if (
                sellerProfile.status !==
                'ACTIVE'
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        'Seller account is not active',
                });
            }

            /*
             * Lock the product and verify ownership.
             */
            const [products] =
                await connection.execute(
                    `SELECT
                        id,
                        status,
                        name,
                        description,
                        price,
                        category_id,
                        brand_id
                     FROM products
                     WHERE id = ?
                       AND seller_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [
                        productId,
                        sellerProfile.id,
                    ],
                );

            if (
                products.length ===
                0
            ) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        'Product not found',
                });
            }

            const product =
                products[0];

            /*
             * Publishing is only allowed from DRAFT.
             */
            if (
                product.status !==
                'DRAFT'
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Only draft products can be published',
                });
            }

            /*
             * Validate the product data again on
             * the backend at publish time.
             */
            if (
                !isValidProductName(
                    product.name,
                ) ||
                !isValidDescription(
                    product.description ||
                    '',
                ) ||
                !isValidPrice(
                    Number(
                        product.price,
                    ),
                )
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product information is incomplete or invalid',
                });
            }

            /*
             * Category must still be active.
             */
            const [
                categoryRows,
            ] =
                await connection.execute(
                    `SELECT id
                     FROM categories
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [product.category_id],
                );

            if (
                categoryRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product category is invalid or inactive',
                });
            }

            /*
             * Brand must still be active.
             */
            const [brandRows] =
                await connection.execute(
                    `SELECT id
                     FROM brands
                     WHERE id = ?
                       AND is_active = 1
                     LIMIT 1`,
                    [product.brand_id],
                );

            if (
                brandRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product brand is invalid or inactive',
                });
            }

            /*
             * A product must have an inventory row.
             */
            const [
                inventoryRows,
            ] =
                await connection.execute(
                    `SELECT
                        id,
                        quantity,
                        reserved_quantity
                     FROM product_inventory
                     WHERE product_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [productId],
                );

            if (
                inventoryRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        'Product inventory record not found',
                });
            }

            const inventory =
                inventoryRows[0];

            const quantity =
                Number(
                    inventory.quantity,
                );

            const reservedQuantity =
                Number(
                    inventory.reserved_quantity,
                );

            if (
                !isValidStock(
                    quantity,
                ) ||
                !isValidStock(
                    reservedQuantity,
                ) ||
                reservedQuantity >
                quantity
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product inventory is invalid',
                });
            }

            /*
             * A product cannot be published without
             * a primary image.
             */
            const [imageRows] =
                await connection.execute(
                    `SELECT
                        id
                     FROM product_images
                     WHERE product_id = ?
                       AND is_primary = 1
                     LIMIT 1
                     FOR UPDATE`,
                    [productId],
                );

            if (
                imageRows.length ===
                0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Product image is required before publishing',
                });
            }

            /*
             * All publish checks passed.
             *
             * Status is changed ONLY here.
             */
            await connection.execute(
                `UPDATE products
                 SET
                    status = 'ACTIVE'
                 WHERE id = ?
                   AND seller_id = ?
                   AND status = 'DRAFT'`,
                [
                    productId,
                    sellerProfile.id,
                ],
            );

            await connection.commit();

            return res.json({
                success: true,
                message:
                    'Product published successfully',

                product: {
                    id:
                        productId.toString(
                            'hex',
                        ),

                    status:
                        'ACTIVE',
                },
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (
                rollbackError
                ) {
                    console.error(
                        'Seller product publish rollback error:',
                        rollbackError,
                    );
                }
            }

            console.error(
                'Seller product publish error:',
                error,
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to publish product',
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
);


module.exports = router;