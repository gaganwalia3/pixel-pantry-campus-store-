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
            'Unable to load marketplace products.',
        );
    }

    return data;
};

const getCategoryMeta = (
    categoryName,
) => {
    const categoryMeta = {
        Audio: 'Sound & tech',
        Home: 'Home comfort',
        Daily: 'Daily carry',
        Green: 'Green living',
    };

    return (
        categoryMeta[
        categoryName
        ] ||
        categoryName ||
        'Campus essentials'
    );
};

export const getPublicProducts =
    async () => {
        const data =
            await request(
                '/api/products?limit=50&offset=0',
            );

        return data.products.map(
            (product) => ({
                /*
                 * Keep the complete product
                 * returned by the backend.
                 */
                ...product,

                /*
                 * Keep the existing frontend
                 * category shape.
                 */
                category:
                    product.category.name,

                /*
                 * Existing category metadata.
                 */
                meta:
                    getCategoryMeta(
                        product.category.name,
                    ),

                /*
                 * Available stock for the
                 * existing ProductCard logic.
                 */
                stock:
                    product.inventory
                        .availableQuantity,

                /*
                 * Product image returned by
                 * /api/products.
                 *
                 * Example:
                 *
                 * {
                 *     imageUrl: "...",
                 *     altText: "...",
                 *     sortOrder: 0,
                 *     isPrimary: true
                 * }
                 */
                image:
                    product.image || null,

                /*
                 * Keep the existing icon field
                 * so the current UI continues
                 * to work.
                 */
                iconClass: '',
            }),
        );
    };