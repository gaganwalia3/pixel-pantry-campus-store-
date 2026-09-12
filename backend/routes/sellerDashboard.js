const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const db = require('../db');

const router = express.Router();

router.use(
    requireAuth,
    requireRole('SELLER'),
);

router.get('/', async (req, res) => {
    try {
        const sellerUserId = Buffer.from(
            req.user.id,
            'hex',
        );

        const [rows] = await db.execute(
            `SELECT
                sp.id,
                sp.shop_name,
                sp.commission_rate,
                sp.status,
                sp.approved_at,

                (
                    SELECT COUNT(*)
                    FROM products p
                    WHERE p.seller_id = sp.id
                ) AS product_count,

                (
                    SELECT COUNT(*)
                    FROM products p
                    WHERE p.seller_id = sp.id
                      AND p.status = 'ACTIVE'
                ) AS active_product_count,

                (
                    SELECT COUNT(*)
                    FROM products p
                    WHERE p.seller_id = sp.id
                      AND p.status = 'DRAFT'
                ) AS draft_product_count

             FROM seller_profiles sp
             INNER JOIN users u
                ON u.id = sp.user_id
             WHERE sp.user_id = ?
               AND u.is_active = 1
             LIMIT 1`,
            [sellerUserId],
        );

        if (rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Seller profile not found',
            });
        }

        const seller = rows[0];

        if (seller.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Seller account is not active',
            });
        }

        return res.json({
            success: true,
            seller: {
                id: seller.id.toString('hex'),
                shopName: seller.shop_name,
                commissionRate: Number(
                    seller.commission_rate,
                ),
                status: seller.status,
                approvedAt: seller.approved_at,
                productCount: Number(
                    seller.product_count,
                ),
                activeProductCount: Number(
                    seller.active_product_count,
                ),
                draftProductCount: Number(
                    seller.draft_product_count,
                ),
            },
        });
    } catch (error) {
        console.error(
            'Seller dashboard lookup error:',
            error,
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to retrieve seller dashboard',
        });
    }
});

module.exports = router;