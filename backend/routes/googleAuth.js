
const crypto = require('crypto');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const db = require('../db');
const {
    googleAuthStartLimiter,
    googleAuthCallbackLimiter,
} = require('../middleware/rateLimit');
const { hashPassword } = require('../utils/password');

const router = express.Router();

const OAUTH_TRANSACTION_TTL_MS = 5 * 60 * 1000;
const GOOGLE_PROVIDER = 'GOOGLE';

const googleClient = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

function createRandomToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function safeCompare(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false;
    }

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
        leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function createAuthenticatedSession(req, user) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((regenerateError) => {
            if (regenerateError) return reject(regenerateError);

            req.session.userId = user.id.toString('hex');

            req.session.save((saveError) => {
                if (saveError) return reject(saveError);
                resolve();
            });
        });
    });
}

function redirectToFrontend(res, result) {
    const destination = new URL(process.env.FRONTEND_URL);

    if (result === 'success') {
        destination.searchParams.set('googleAuth', 'success');
    } else {
        destination.searchParams.set('authError', 'google_auth_failed');
    }

    return res.redirect(303, destination.toString());
}

function isValidEmail(email) {
    return (
        typeof email === 'string' &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
}





async function resolveGoogleUser({
    providerSubject,
    providerEmail,
    name,
}) {





    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Recheck under transaction to protect against concurrent callbacks.
        const [identityRows] = await connection.execute(
            `SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u.is_active
             FROM auth_identities ai
             INNER JOIN users u ON u.id = ai.user_id
             WHERE ai.provider = ?
               AND ai.provider_subject = ?
             LIMIT 1
             FOR UPDATE`,
            [GOOGLE_PROVIDER, providerSubject],
        );

        if (identityRows.length > 0) {
            const user = identityRows[0];

            if (!user.is_active) {
                throw new Error('ACCOUNT_INACTIVE');
            }

            await connection.commit();
            return user;
        }

        // Lock an existing account with this email before linking.
        const [userRows] = await connection.execute(
            `SELECT
                id,
                name,
                email,
                role,
                is_active,
                email_verified_at
             FROM users
             WHERE email = ?
             LIMIT 1
             FOR UPDATE`,
            [providerEmail],
        );

        let user;

        if (userRows.length > 0) {
            user = userRows[0];

            if (!user.is_active) {
                throw new Error('ACCOUNT_INACTIVE');
            }

            // Never link Google to an existing unverified local account.
            if (!user.email_verified_at) {
                throw new Error('EXISTING_EMAIL_NOT_VERIFIED');
            }
        } else {
            const randomPassword = crypto.randomBytes(48).toString('base64url');
            const unusablePasswordHash = await hashPassword(randomPassword);

            const userId = Buffer.from(
                crypto.randomUUID().replace(/-/g, ''),
                'hex',
            );

            const cleanName =
                typeof name === 'string' && name.trim()
                    ? name.trim().slice(0, 100)
                    : providerEmail.split('@')[0].slice(0, 100);

            await connection.execute(
                `INSERT INTO users (
                    id,
                    name,
                    email,
                    password_hash,
                    role,
                    email_verified_at
                )
                VALUES (?, ?, ?, ?, 'CUSTOMER', CURRENT_TIMESTAMP(6))`,
                [
                    userId,
                    cleanName,
                    providerEmail,
                    unusablePasswordHash,
                ],
            );

            user = {
                id: userId,
                name: cleanName,
                email: providerEmail,
                role: 'CUSTOMER',
                is_active: 1,
            };
        }

        const identityId = Buffer.from(
            crypto.randomUUID().replace(/-/g, ''),
            'hex',
        );

        await connection.execute(
            `INSERT INTO auth_identities (
                id,
                user_id,
                provider,
                provider_subject,
                provider_email
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                identityId,
                user.id,
                GOOGLE_PROVIDER,
                providerSubject,
                providerEmail,
            ],
        );

        await connection.commit();

        return user;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                'Google OAuth transaction rollback failed:',
                rollbackError.code || rollbackError.name || 'UNKNOWN_ERROR',
            );
        }

        throw error;
    } finally {
        connection.release();
    }
}


// Start Google OAuth.
router.get(
    '/google',
    googleAuthStartLimiter,
    async (req, res) => {
        if (
            !process.env.GOOGLE_CLIENT_ID ||
            !process.env.GOOGLE_CLIENT_SECRET ||
            !process.env.GOOGLE_REDIRECT_URI
        ) {
            return res.status(503).json({
                success: false,
                message: 'Google sign-in is currently unavailable.',
            });
        }

        try {
            const state = createRandomToken();
            const nonce = createRandomToken();

            const { codeVerifier, codeChallenge } =
                await googleClient.generateCodeVerifierAsync();

            req.session.googleOAuth = {
                state,
                nonce,
                codeVerifier,
                createdAt: Date.now(),
            };

            await saveSession(req);

            const authorizationUrl = googleClient.generateAuthUrl({
                scope: ['openid', 'email', 'profile'],
                state,
                nonce,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                access_type: 'online',
                prompt: 'select_account',
            });

            return res.redirect(302, authorizationUrl);
        } catch (error) {
            console.error(
                'Google OAuth initiation failed:',
                error.code || error.name || 'UNKNOWN_ERROR',
            );

            return res.status(500).json({
                success: false,
                message: 'Unable to start Google sign-in.',
            });
        }
    },
);


// Google OAuth callback.
router.get(
    '/google/callback',
    googleAuthCallbackLimiter,
    async (req, res) => {
        let transaction;

        try {
            transaction = req.session?.googleOAuth;

            const receivedState = req.query.state;
            const authorizationCode = req.query.code;

            if (
                !transaction ||
                typeof receivedState !== 'string' ||
                !safeCompare(receivedState, transaction.state) ||
                !Number.isFinite(transaction.createdAt) ||
                Date.now() - transaction.createdAt >
                OAUTH_TRANSACTION_TTL_MS ||
                Date.now() < transaction.createdAt
            ) {
                return redirectToFrontend(res, 'failure');
            }

            // Consume the OAuth transaction before exchanging the code.
            // This prevents callback replay with the same session state.
            delete req.session.googleOAuth;
            await saveSession(req);

            if (
                req.query.error ||
                typeof authorizationCode !== 'string' ||
                !authorizationCode
            ) {
                return redirectToFrontend(res, 'failure');
            }

            const { tokens } = await googleClient.getToken({
                code: authorizationCode,
                codeVerifier: transaction.codeVerifier,
            });

            if (!tokens.id_token) {
                return redirectToFrontend(res, 'failure');
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();

            if (
                !payload ||
                payload.email_verified !== true ||
                typeof payload.sub !== 'string' ||
                !payload.sub ||
                !isValidEmail(payload.email) ||
                typeof payload.nonce !== 'string' ||
                !safeCompare(payload.nonce, transaction.nonce)
            ) {
                return redirectToFrontend(res, 'failure');
            }

            const providerEmail = payload.email.trim().toLowerCase();

            const user = await resolveGoogleUser({
                providerSubject: payload.sub,
                providerEmail,
                name: payload.name,
            });

            if (!user || !user.is_active) {
                return redirectToFrontend(res, 'failure');
            }

            await createAuthenticatedSession(req, user);

            return redirectToFrontend(res, 'success');
        } catch (error) {
            // Never log authorization codes, tokens, provider responses,
            // or raw error messages from the OAuth library.
            console.error(
                'Google OAuth callback failed:',
                error.code || error.name || 'UNKNOWN_ERROR',
            );

            return redirectToFrontend(res, 'failure');
        }
    },
);

module.exports = router;
