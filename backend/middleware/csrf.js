const { csrfSync } = require('csrf-sync');

const {
    csrfSynchronisedProtection,
    generateToken,
} = csrfSync({
    getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'];
    },
});

module.exports = {
    csrfSynchronisedProtection,
    generateToken,
};