const API_URL =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

const request = async (path) => {
    const response = await fetch(
        `${API_URL}${path}`,
        {
            credentials: 'include',
            headers: {
                'Content-Type':
                    'application/json',
            },
        },
    );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            'Unable to load marketplace data.',
        );
    }

    return data;
};

export const getPublicBrands =
    async () => {
        const data =
            await request(
                '/api/products/brands',
            );

        return data.brands;
    };

export const getPublicCategories =
    async () => {
        const data =
            await request(
                '/api/products/categories',
            );

        return data.categories;
    };

export const getPublicProducts =
    async ({
        category = '',
        brand = '',
        search = '',
    } = {}) => {
        const params =
            new URLSearchParams({
                limit: '50',
                offset: '0',
            });

        if (category) {
            params.set(
                'category',
                category,
            );
        }

        if (brand) {
            params.set(
                'brand',
                brand,
            );
        }

        if (search) {
            params.set(
                'q',
                search,
            );
        }

        const data =
            await request(
                `/api/products?${params.toString()}`,
            );

        return data.products.map(
            (product) => ({
                ...product,

                category:
                    product.category,

                brand:
                    product.brand,

                stock:
                    product.inventory
                        .availableQuantity,

                image:
                    product.image || null,

                iconClass: '',
            }),
        );
    };