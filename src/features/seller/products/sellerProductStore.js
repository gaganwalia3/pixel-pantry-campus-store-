import { getCsrfToken } from '../../auth/authStore';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

const request = async (
    path,
    options = {},
) => {
    const response = await fetch(
        `${API_URL}${path}`,
        {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type':
                    'application/json',
                ...(options.headers || {}),
            },
        },
    );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            'Unable to process seller product request',
        );
    }

    return data;
};


/* =========================================================
   PRODUCT OPTIONS
   ========================================================= */

export const getSellerProductOptions =
    async () => {
        const data =
            await request(
                '/api/seller/products/options',
            );

        return {
            categories:
                data.categories,
            brands:
                data.brands,
        };
    };


/* =========================================================
   SELLER PRODUCTS
   ========================================================= */

export const getSellerProducts =
    async () => {
        const data =
            await request(
                '/api/seller/products',
            );

        return data.products;
    };


/* =========================================================
   CREATE SELLER PRODUCT
   ========================================================= */

export const createSellerProduct =
    async ({
        name,
        description,
        price,
        categoryId,
        brandId,
        stock,
    }) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                '/api/seller/products',
                {
                    method: 'POST',

                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },

                    body: JSON.stringify({
                        name,
                        description,
                        price,
                        categoryId,
                        brandId,
                        stock,
                    }),
                },
            );

        return data.product;
    };


/* =========================================================
   UPDATE SELLER PRODUCT
   ========================================================= */

export const updateSellerProduct =
    async ({
        productId,
        name,
        description,
        price,
        categoryId,
        brandId,
        stock,
    }) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                `/api/seller/products/${productId}`,
                {
                    method: 'PATCH',

                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },

                    body: JSON.stringify({
                        name,
                        description,
                        price,
                        categoryId,
                        brandId,
                        stock,
                    }),
                },
            );

        return data.product;
    };


/* =========================================================
   PUBLISH SELLER PRODUCT
   ========================================================= */

export const publishSellerProduct =
    async (productId) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                `/api/seller/products/${productId}/publish`,
                {
                    method: 'PATCH',

                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },
                },
            );

        return data.product;
    };
/* =========================================================
UPLOAD SELLER PRODUCT IMAGE
========================================================= */

export const uploadSellerProductImage =
    async ({
        productId,
        file,
    }) => {
        if (!file) {
            throw new Error(
                'Product image is required.',
            );
        }

        const csrfToken =
            await getCsrfToken();

        const formData =
            new FormData();

        formData.append(
            'image',
            file,
        );

        const response =
            await fetch(
                `${API_URL}/api/seller/products/${productId}/images`,
                {
                    method: 'POST',

                    credentials:
                        'include',

                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },

                    body: formData,
                },
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                'Unable to upload product image',
            );
        }

        return data.image;
    };