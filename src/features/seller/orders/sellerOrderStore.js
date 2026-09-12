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
            'Unable to process seller order request',
        );
    }

    return data;
};

export const getSellerOrders =
    async () => {
        const data =
            await request(
                '/api/seller/orders',
            );

        return data.orders;
    };

export const markSellerOrderReady =
    async (orderId) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                `/api/seller/orders/${orderId}/ready`,
                {
                    method: 'PATCH',
                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },
                },
            );

        return data;
    };