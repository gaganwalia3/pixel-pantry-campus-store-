const rateLimit = require('express-rate-limit');

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,

    standardHeaders: 'draft-8',
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
});

const sellerProductRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,

    standardHeaders: 'draft-8',
    legacyHeaders: false,

    message: {
        success: false,
        message:
            'Too many product requests. Please try again later.',
    },
});

module.exports = {
    authRateLimiter,
    sellerProductRateLimiter,
};