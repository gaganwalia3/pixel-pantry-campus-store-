const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const db = require('../db');

const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', async (req, res) => {
    try {
        const [applications] = await db.execute(
            `SELECT
                sa.id,
                sa.user_id,
                sa.shop_name,
                sa.description,
                sa.status,
                sa.rejection_reason,
                sa.created_at,
                sa.updated_at,
                u.name AS applicant_name,
                u.email AS applicant_email
             FROM seller_applications sa
             INNER JOIN users u
                ON u.id = sa.user_id
             ORDER BY
                CASE
                    WHEN sa.status = 'PENDING' THEN 0
                    ELSE 1
                END,
                sa.created_at DESC`,
        );

        return res.json({
            success: true,
            applications: applications.map((application) => ({
                id: application.id.toString('hex'),
                userId: application.user_id.toString('hex'),
                shopName: application.shop_name,
                description: application.description,
                status: application.status,
                rejectionReason: application.rejection_reason,
                applicant: {
                    name: application.applicant_name,
                    email: application.applicant_email,
                },
                submittedAt: application.created_at,
                updatedAt: application.updated_at,
            })),
        });
    } catch (error) {
        console.error(
            'Admin seller application lookup error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve seller applications',
        });
    }
});

router.patch('/:id', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { status, rejectionReason } = req.body;

        if (
            status !== 'APPROVED' &&
            status !== 'REJECTED'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application status',
            });
        }

        if (
            status === 'REJECTED' &&
            rejectionReason !== undefined &&
            typeof rejectionReason !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason must be text',
            });
        }

        let applicationId;

        try {
            applicationId = Buffer.from(req.params.id, 'hex');
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid application id',
            });
        }

        if (applicationId.length !== 16) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application id',
            });
        }

        const trimmedRejectionReason =
            typeof rejectionReason === 'string'
                ? rejectionReason.trim()
                : '';

        if (
            status === 'REJECTED' &&
            trimmedRejectionReason.length > 500
        ) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is too long',
            });
        }

        if (
            status === 'REJECTED' &&
            trimmedRejectionReason.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required',
            });
        }

        await connection.beginTransaction();

        const [applications] = await connection.execute(
            `SELECT
                id,
                user_id,
                shop_name,
                status
             FROM seller_applications
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [applicationId],
        );

        if (applications.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Seller application not found',
            });
        }

        const application = applications[0];

        if (application.status !== 'PENDING') {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: 'Only pending applications can be reviewed',
            });
        }

        if (status === 'APPROVED') {
            const [existingProfiles] = await connection.execute(
                `SELECT id
                 FROM seller_profiles
                 WHERE user_id = ?
                 LIMIT 1`,
                [application.user_id],
            );

            if (existingProfiles.length > 0) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: 'This user already has a seller profile',
                });
            }

            const [users] = await connection.execute(
                `SELECT id, role, is_active
                 FROM users
                 WHERE id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [application.user_id],
            );

            if (
                users.length === 0 ||
                !users[0].is_active
            ) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: 'The applicant account is unavailable',
                });
            }

            const sellerProfileId = Buffer.from(
                crypto.randomUUID().replace(/-/g, ''),
                'hex',
            );

            await connection.execute(
                `UPDATE seller_applications
                 SET
                    status = 'APPROVED',
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP(6),
                    rejection_reason = NULL
                 WHERE id = ?`,
                [
                    Buffer.from(req.user.id, 'hex'),
                    application.id,
                ],
            );

            await connection.execute(
                `UPDATE users
                 SET role = 'SELLER'
                 WHERE id = ?`,
                [application.user_id],
            );

            await connection.execute(
                `INSERT INTO seller_profiles (
                    id,
                    user_id,
                    shop_name,
                    status,
                    approved_at
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    'ACTIVE',
                    CURRENT_TIMESTAMP(6)
                )`,
                [
                    sellerProfileId,
                    application.user_id,
                    application.shop_name,
                ],
            );
        } else {
            await connection.execute(
                `UPDATE seller_applications
                 SET
                    status = 'REJECTED',
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP(6),
                    rejection_reason = ?
                 WHERE id = ?`,
                [
                    Buffer.from(req.user.id, 'hex'),
                    trimmedRejectionReason,
                    application.id,
                ],
            );
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                status === 'APPROVED'
                    ? 'Seller application approved successfully'
                    : 'Seller application rejected successfully',
            status,
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            'Admin seller application review error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to review seller application',
        });
    } finally {
        connection.release();
    }
});

module.exports = router;