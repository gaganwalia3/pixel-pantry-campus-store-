import { getCsrfToken } from '../auth/authStore';

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
            'Unable to process admin order request',
        );
    }

    return data;
};

export const getAdminOrders =
    async () => {
        const data =
            await request(
                '/api/admin/orders',
            );

        return data.orders;
    };

export const updateAdminOrderStatus =
    async ({
        orderId,
        status,
    }) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                `/api/admin/orders/${orderId}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        'X-CSRF-Token':
                            csrfToken,
                    },
                    body: JSON.stringify({
                        status,
                    }),
                },
            );

        return data;
    };

export const markAdminOrderItemDelivered =
    async ({
        orderId,
        itemId,
    }) => {
        const csrfToken =
            await getCsrfToken();

        const data =
            await request(
                `/api/admin/orders/${orderId}/items/${itemId}/deliver`,
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