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
            data.message || 'Something went wrong',
        );
    }

    return data;
};

export const getCsrfToken = async () => {
    const data = await request('/api/auth/csrf-token');

    return data.csrfToken;
};

export const getSession = async () => {
    try {
        const data = await request('/api/auth/me');

        return {
            isAuthenticated: true,
            user: data.user,
        };
    } catch {
        return {
            isAuthenticated: false,
            user: null,
        };
    }
};

export const signUp = async ({
    name,
    email,
    password,
    csrfToken,
}) => {
    const data = await request('/api/auth/register', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
            name,
            email,
            password,
        }),
    });

    return data;
};

export const signIn = async ({
    email,
    password,
    csrfToken,
}) => {
    const data = await request('/api/auth/login', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
            email,
            password,
        }),
    });

    return {
        isAuthenticated: true,
        user: data.user,
    };
};

export const signOut = async ({
    csrfToken,
}) => {
    await request('/api/auth/logout', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
    });

    return {
        isAuthenticated: false,
        user: null,
    };
};