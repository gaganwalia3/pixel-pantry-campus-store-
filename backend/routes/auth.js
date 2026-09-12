const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const db = require('../db');
const { authRateLimiter } = require('../middleware/rateLimit');

const {
    hashPassword,
    comparePassword,
} = require('../utils/password');

const router = express.Router();

router.post('/register', authRateLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required',
            });
        }

        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name must be between 2 and 100 characters',
            });
        }

        if (normalizedEmail.length > 254) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
            });
        }

        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail],
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists',
            });
        }

        const passwordHash = await hashPassword(password);

        const userId = Buffer.from(
            crypto.randomUUID().replace(/-/g, ''),
            'hex',
        );

        await db.execute(
            `INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                role
            ) VALUES (?, ?, ?, ?, 'CUSTOMER')`,
            [
                userId,
                trimmedName,
                normalizedEmail,
                passwordHash,
            ],
        );

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
        });
    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to create account',
        });
    }
});
router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

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
            [normalizedEmail],
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        const passwordMatches = await comparePassword(
            password,
            user.password_hash,
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error('Session regeneration error:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Unable to login',
                });
            }

            req.session.userId = user.id.toString('hex');

            return res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.id.toString('hex'),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            });
        });
    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to login',
        });
    }
});
router.get('/me', requireAuth, (req, res) => {
    return res.json({
        success: true,
        user: req.user,
    });
});
router.post('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error('Logout error:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to logout',
            });
        }

        res.clearCookie('connect.sid');

        return res.json({
            success: true,
            message: 'Logout successful',
        });
    });
});
router.get('/csrf-token', (req, res) => {
    return res.json({
        success: true,
        csrfToken: generateToken(req),
    });
});
module.exports = router;