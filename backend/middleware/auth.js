const db = require('../db');

const requireAuth = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const [users] = await db.execute(
            `SELECT
                id,
                name,
                email,
                role,
                is_active
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [Buffer.from(req.session.userId, 'hex')],
        );

        if (users.length === 0 || !users[0].is_active) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const user = users[0];

        req.user = {
            id: user.id.toString('hex'),
            name: user.name,
            email: user.email,
            role: user.role,
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to verify authentication',
        });
    }
};

module.exports = {
    requireAuth,
};