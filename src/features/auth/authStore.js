const API_BASE_URL = (
    import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

const AUTH_BASE_URL = `${API_BASE_URL}/api/auth`;

async function parseResponse(response) {
    const responseText = await response.text();

    if (!responseText) {
        return null;
    }

    try {
        return JSON.parse(responseText);
    } catch {
        return responseText;
    }
}

function getErrorMessage(data, fallbackMessage) {
    if (typeof data === 'string' && data.trim()) {
        return data;
    }

    if (data && typeof data.message === 'string') {
        return data.message;
    }

    if (data && typeof data.error === 'string') {
        return data.error;
    }

    return fallbackMessage;
}

async function request(path, options = {}) {
    const {
        method = 'GET',
        body,
        headers = {},
        includeCsrf = false,
    } = options;

    const requestHeaders = {
        Accept: 'application/json',
        ...headers,
    };

    if (body !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    if (includeCsrf) {
        const csrfToken = await getCsrfToken();

        if (typeof csrfToken !== 'string' || !csrfToken) {
            throw new Error('Unable to obtain a valid CSRF token.');
        }

        requestHeaders['X-Csrf-Token'] = csrfToken;
    }

    const response = await fetch(`${AUTH_BASE_URL}${path}`, {
        method,
        headers: requestHeaders,
        credentials: 'include',
        cache: 'no-store',
        ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
    });

    const data = await parseResponse(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(data, 'The request could not be completed.')
        );
    }

    return data;
}

/**
 * Fetch a CSRF token associated with the current session.
 * The API returns: { csrfToken: "..." }
 */
export async function getCsrfToken() {
    const response = await fetch(`${AUTH_BASE_URL}/csrf-token`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
    });

    const data = await parseResponse(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(data, 'Unable to fetch CSRF token.')
        );
    }

    if (
        !data ||
        typeof data.csrfToken !== 'string' ||
        data.csrfToken.length === 0
    ) {
        throw new Error('The server returned an invalid CSRF token.');
    }

    return data.csrfToken;
}

/**
 * Get the currently authenticated user's session.
 */
export async function getSession() {
    const response = await request('/me');

    if (!response?.success || !response.user) {
        return {
            isAuthenticated: false,
            user: null,
        };
    }

    return {
        isAuthenticated: true,
        user: response.user,
    };
}

/**
 * Begin registration.
 * Expected response: OTP challenge information.
 */
export async function signUp({ name, email, password }) {
    return request('/register', {
        method: 'POST',
        includeCsrf: true,
        body: {
            name,
            email,
            password,
        },
    });
}

/**
 * Begin login.
 * Expected response: OTP challenge information.
 */
export async function signIn({ email, password }) {
    return request('/login', {
        method: 'POST',
        includeCsrf: true,
        body: {
            email,
            password,
        },
    });
}

/**
 * Verify the OTP challenge.
 * Expected input: { challengeId, otp }
 */
export async function verifyOtp({ challengeId, otp }) {
    return request('/verify-otp', {
        method: 'POST',
        includeCsrf: true,
        body: {
            challengeId,
            otp,
        },
    });
}

/**
 * Request a replacement OTP for an existing challenge.
 */
export async function resendOtp({ challengeId }) {
    return request('/resend-otp', {
        method: 'POST',
        includeCsrf: true,
        body: {
            challengeId,
        },
    });
}

/**
 * End the current authenticated session.
 */
export async function signOut() {
    return request('/logout', {
        method: 'POST',
        includeCsrf: true,
    });
}