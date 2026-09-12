import {
    SELLER_APPLICATION_INITIAL_STATE,
} from './sellerApplicationConstants';
import { getCsrfToken } from '../../auth/authStore';

const API_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:5000';

const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || 'Unable to process seller application',
        );
    }

    return data;
};

export const getSellerApplication = async () => {
    try {
        const data = await request('/api/seller-applications/me');

        if (!data.application) {
            return SELLER_APPLICATION_INITIAL_STATE;
        }

        return {
            status: data.application.status,
            submittedAt: data.application.submittedAt,
            applicant: {
                shopName: data.application.shopName,
                description: data.application.description,
            },
            rejectionReason: data.application.rejectionReason,
        };
    } catch (error) {
        if (error.message === 'Authentication required') {
            return SELLER_APPLICATION_INITIAL_STATE;
        }

        throw error;
    }
};

export const submitSellerApplication = async (application) => {
    const csrfToken = await getCsrfToken();

    const data = await request('/api/seller-applications', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
            shopName: application.shopName,
            description: application.description,
            acceptsRules: application.acceptsRules,
        }),
    });

    return {
        status: data.application.status,
        submittedAt: data.application.submittedAt,
        applicant: {
            shopName: application.shopName.trim(),
            description: application.description.trim(),
        },
    };
};