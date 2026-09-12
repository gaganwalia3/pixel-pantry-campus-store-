const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
    try {
        const {
            shopName,
            description,
            acceptsRules,
        } = req.body;

        if (
            typeof shopName !== 'string' ||
            typeof description !== 'string' ||
            typeof acceptsRules !== 'boolean'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Shop name, description and acceptance of seller guidelines are required',
            });
        }

        if (!acceptsRules) {
            return res.status(400).json({
                success: false,
                message: 'You must accept the seller guidelines',
            });
        }

        const trimmedShopName = shopName.trim();
        const trimmedDescription = description.trim();

        if (
            trimmedShopName.length < 2 ||
            trimmedShopName.length > 120
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Shop name must be between 2 and 120 characters',
            });
        }

        if (trimmedDescription.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Store description is required',
            });
        }

        if (trimmedDescription.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Store description is too long',
            });
        }

        const userId = Buffer.from(req.user.id, 'hex');

        const [existingApplications] = await db.execute(
            `SELECT
                id,
                status,
                created_at
             FROM seller_applications
             WHERE user_id = ?
               AND status = 'PENDING'
             LIMIT 1`,
            [userId],
        );

        if (existingApplications.length > 0) {
            const existingApplication = existingApplications[0];

            return res.status(409).json({
                success: false,
                message:
                    'You already have a pending seller application',
                application: {
                    id: existingApplication.id.toString('hex'),
                    status: existingApplication.status,
                    submittedAt: existingApplication.created_at,
                },
            });
        }

        const applicationId = Buffer.from(
            crypto.randomUUID().replace(/-/g, ''),
            'hex',
        );

        await db.execute(
            `INSERT INTO seller_applications (
                id,
                user_id,
                shop_name,
                description,
                status
            ) VALUES (?, ?, ?, ?, 'PENDING')`,
            [
                applicationId,
                userId,
                trimmedShopName,
                trimmedDescription,
            ],
        );

        return res.status(201).json({
            success: true,
            message: 'Seller application submitted successfully',
            application: {
                id: applicationId.toString('hex'),
                status: 'PENDING',
                submittedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error(
            'Seller application submission error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to submit seller application',
        });
    }
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        const userId = Buffer.from(req.user.id, 'hex');

        const [applications] = await db.execute(
            `SELECT
                id,
                shop_name,
                description,
                status,
                rejection_reason,
                created_at,
                updated_at
             FROM seller_applications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId],
        );

        if (applications.length === 0) {
            return res.json({
                success: true,
                application: null,
            });
        }

        const application = applications[0];

        return res.json({
            success: true,
            application: {
                id: application.id.toString('hex'),
                shopName: application.shop_name,
                description: application.description,
                status: application.status,
                rejectionReason: application.rejection_reason,
                submittedAt: application.created_at,
                updatedAt: application.updated_at,
            },
        });
    } catch (error) {
        console.error(
            'Seller application lookup error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve seller application',
        });
    }
});

module.exports = router;