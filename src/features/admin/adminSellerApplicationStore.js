import { getCsrfToken } from '../auth/authStore';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

const request = async (path, options = {}) => {
    const response = await fetch(
        `${API_URL}${path}`,
        {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        },
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            'Unable to process admin request',
        );
    }

    return data;
};

export const getAdminSellerApplications =
    async () => {
        const data = await request(
            '/api/admin/seller-applications',
        );

        return data.applications;
    };

export const reviewSellerApplication =
    async ({
        applicationId,
        status,
        rejectionReason,
    }) => {
        const csrfToken =
            await getCsrfToken();

        const data = await request(
            `/api/admin/seller-applications/${applicationId}`,
            {
                method: 'PATCH',
                headers: {
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    status,
                    rejectionReason,
                }),
            },
        );

        return data;
    };