
const crypto = require('crypto');
const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const { authRateLimiter } = require('../middleware/rateLimit');
const { hashPassword, comparePassword } = require('../utils/password');
const { issueOtp, resendOtp, verifyOtp } = require('../services/otpService');
const db = require('../db');

const router = express.Router();

function sendOtpError(res, error, fallbackMessage) {
    const status = Number.isInteger(error.status)
        ? error.status
        : 500;

    if (status >= 500) {
        console.error(fallbackMessage, error);
        return res.status(500).json({
            success: false,
            message: fallbackMessage,
        });
    }

    return res.status(status).json({
        success: false,
        message: error.message,
    });
}

function createAuthenticatedSession(req, user) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((regenerateError) => {
            if (regenerateError) {
                return reject(regenerateError);
            }

            req.session.userId = user.id.toString('hex');

            req.session.save((saveError) => {
                if (saveError) {
                    return reject(saveError);
                }

                resolve();
            });
        });
    });
}

function getPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
}


// Register: create account, but do not authenticate until OTP succeeds.
router.post('/register', authRateLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required.',
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name must be between 2 and 100 characters.',
            });
        }

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid email address.',
            });
        }

        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Password must be between 8 and 128 characters.',
            });
        }

        const [existingUsers] = await db.execute(
            `SELECT id
       FROM users
       WHERE email = ?
       LIMIT 1`,
            [cleanEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.',
            });
        }

        const passwordHash = await hashPassword(password);

        const userId = Buffer.from(
            crypto.randomUUID().replace(/-/g, ''),
            'hex'
        );

        await db.execute(
            `INSERT INTO users
         (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'CUSTOMER')`,
            [userId, cleanName, cleanEmail, passwordHash]
        );

        const otpChallenge = await issueOtp({
            userId,
            email: cleanEmail,
            purpose: 'REGISTER',
        });

        return res.status(201).json({
            success: true,
            requiresOtp: true,
            message: 'Verification code sent to your email.',
            challengeId: otpChallenge.challengeId,
            expiresInSeconds: otpChallenge.expiresInSeconds,
        });
    } catch (error) {
        return sendOtpError(
            res,
            error,
            'Unable to create account.'
        );
    }
});


// Login: validate password first, then require email OTP.
router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.',
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
            password.length > 128
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            });
        }

        const [users] = await db.execute(
            `SELECT
         id,
         name,
         email,
         password_hash,
         role,
         is_active
       FROM users
       WHERE email = ?
       LIMIT 1`,
            [cleanEmail]
        );

        const user = users[0];

        if (
            !user ||
            !user.is_active ||
            !(await comparePassword(password, user.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            });
        }

        const otpChallenge = await issueOtp({
            userId: user.id,
            email: user.email,
            purpose: 'LOGIN',
        });

        return res.json({
            success: true,
            requiresOtp: true,
            message: 'Verification code sent to your email.',
            challengeId: otpChallenge.challengeId,
            expiresInSeconds: otpChallenge.expiresInSeconds,
        });
    } catch (error) {
        return sendOtpError(
            res,
            error,
            'Unable to sign in.'
        );
    }
});


// Verify OTP: only this endpoint creates the authenticated session.
router.post('/verify-otp', authRateLimiter, async (req, res) => {
    try {
        const { challengeId, otp } = req.body || {};

        const user = await verifyOtp({
            challengeId,
            otp,
        });

        await createAuthenticatedSession(req, user);

        return res.json({
            success: true,
            message: 'Email verified successfully.',
            user: getPublicUser(user),
        });
    } catch (error) {
        return sendOtpError(
            res,
            error,
            'Unable to verify the code.'
        );
    }
});


// Resend OTP: uses the existing challenge ID.
router.post('/resend-otp', authRateLimiter, async (req, res) => {
    try {
        const { challengeId } = req.body || {};

        const result = await resendOtp({
            challengeId,
        });

        return res.json({
            success: true,
            message: 'A new verification code has been sent.',
            expiresInSeconds: result.expiresInSeconds,
        });
    } catch (error) {
        return sendOtpError(
            res,
            error,
            'Unable to resend the verification code.'
        );
    }
});


// Current authenticated user.
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT id, name, email, role
       FROM users
       WHERE id = ?
         AND is_active = 1
       LIMIT 1`,
            [Buffer.from(req.session.userId, 'hex')]
        );

        const user = users[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated.',
            });
        }

        return res.json({
            success: true,
            user: {
                id: user.id.toString('hex'),
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Session lookup error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve session.',
        });
    }
});


// Logout.
router.post('/logout', async (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error('Logout error:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to sign out.',
            });
        }

        res.clearCookie('connect.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return res.json({
            success: true,
            message: 'Signed out successfully.',
        });
    });
});


// CSRF token endpoint.
router.get('/csrf-token', (req, res) => {
    return res.json({
        csrfToken: generateToken(req),
    });
});

module.exports = router;
