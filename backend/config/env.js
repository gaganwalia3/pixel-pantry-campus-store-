const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'SESSION_SECRET',
    'FRONTEND_URL',
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

    if (!['http:', 'https:'].includes(parsedFrontendUrl.protocol)) {
        throw new Error(
            'FRONTEND_URL must use HTTP or HTTPS',
        );
    }

    if (process.env.NODE_ENV === 'production') {
        if (process.env.SESSION_SECRET.length < 32) {
            throw new Error(
                'SESSION_SECRET must be at least 32 characters in production',
            );
        }

        if (parsedFrontendUrl.protocol !== 'https:') {
            throw new Error(
                'FRONTEND_URL must use HTTPS in production',
            );
        }
    }
};

module.exports = {
    validateEnv,
};