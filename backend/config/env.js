const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'SESSION_SECRET',
    'FRONTEND_URL',
];

const googleEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
];

const validateEnv = () => {
    const missing = requiredEnvVars.filter((name) => {
        return (
            typeof process.env[name] !== 'string' ||
            process.env[name].trim() === ''
        );
    });

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`,
        );
    }

    const dbPort = Number(process.env.DB_PORT);

    if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
        throw new Error('DB_PORT must be a valid TCP port');
    }

    const frontendUrl = process.env.FRONTEND_URL.trim();

    let parsedFrontendUrl;

    try {
        parsedFrontendUrl = new URL(frontendUrl);
    } catch {
        throw new Error('FRONTEND_URL must be a valid URL');
    }

    if (
        !['http:', 'https:'].includes(parsedFrontendUrl.protocol) ||
        parsedFrontendUrl.username ||
        parsedFrontendUrl.password ||
        parsedFrontendUrl.search ||
        parsedFrontendUrl.hash
    ) {
        throw new Error('FRONTEND_URL must be a valid URL without credentials, query parameters, or fragments');
    }

    if (process.env.NODE_ENV === 'production') {
        if (process.env.SESSION_SECRET.length < 32) {
            throw new Error(
                'SESSION_SECRET must be at least 32 characters in production',
            );
        }

        if (parsedFrontendUrl.protocol !== 'https:') {
            throw new Error('FRONTEND_URL must use HTTPS in production');
        }
    }

    // Google OAuth configuration must be either fully configured or absent.
    const configuredGoogleVars = googleEnvVars.filter((name) => {
        return (
            typeof process.env[name] === 'string' &&
            process.env[name].trim() !== ''
        );
    });

    if (
        configuredGoogleVars.length !== 0 &&
        configuredGoogleVars.length !== googleEnvVars.length
    ) {
        throw new Error(
            'Google OAuth configuration is incomplete. Set all three Google OAuth environment variables.',
        );
    }

    if (configuredGoogleVars.length === googleEnvVars.length) {
        const clientId = process.env.GOOGLE_CLIENT_ID.trim();
        const redirectUri = process.env.GOOGLE_REDIRECT_URI.trim();

        if (!clientId.endsWith('.apps.googleusercontent.com')) {
            throw new Error('GOOGLE_CLIENT_ID has an invalid format');
        }

        let parsedRedirectUri;

        try {
            parsedRedirectUri = new URL(redirectUri);
        } catch {
            throw new Error('GOOGLE_REDIRECT_URI must be a valid URL');
        }

        if (
            parsedRedirectUri.username ||
            parsedRedirectUri.password ||
            parsedRedirectUri.search ||
            parsedRedirectUri.hash ||
            parsedRedirectUri.pathname !== '/api/auth/google/callback'
        ) {
            throw new Error('GOOGLE_REDIRECT_URI has an invalid callback URL format');
        }

        const isProductionRedirect =
            parsedRedirectUri.hostname === 'campus-store-backend-dyy4.onrender.com' &&
            parsedRedirectUri.protocol === 'https:' &&
            parsedRedirectUri.port === '';

        const isLocalRedirect =
            parsedRedirectUri.hostname === 'localhost' &&
            parsedRedirectUri.protocol === 'http:' &&
            parsedRedirectUri.port === '5000';

        if (process.env.NODE_ENV === 'production') {
            if (!isProductionRedirect) {
                throw new Error(
                    'Production GOOGLE_REDIRECT_URI must use the approved Render HTTPS callback host.',
                );
            }
        } else if (!isProductionRedirect && !isLocalRedirect) {
            throw new Error(
                'GOOGLE_REDIRECT_URI must use the approved production or localhost callback host.',
            );
        }
    }
};

module.exports = {
    validateEnv,
};