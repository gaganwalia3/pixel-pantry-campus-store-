const { csrfSync } = require('csrf-sync');

const {
    csrfSynchronisedProtection,
    generateToken,
} = csrfSync({
    getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'];
    },
});

const csrfProtection = (req, res, next) => {
    const isGoogleOAuthCallback =
        req.method === 'GET' &&
        req.path === '/api/auth/google/callback';

    if (isGoogleOAuthCallback) {
        return next();
    }

    return csrfSynchronisedProtection(req, res, next);
};

module.exports = {
    csrfSynchronisedProtection: csrfProtection,
    generateToken,
};