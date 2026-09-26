require('dotenv').config();

const { validateEnv } = require('./config/env');

validateEnv();

const express = require('express');
const db = require('./db');
const authRoutes = require('./routes/auth');
const sellerApplicationRoutes = require('./routes/sellerApplications');
const adminSellerApplicationRoutes = require('./routes/adminSellerApplications');
const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');
const knex = require('knex');
const helmet = require('helmet');
const cors = require('cors');
const { csrfSynchronisedProtection } = require('./middleware/csrf');
const sellerProductRoutes = require('./routes/sellerProducts');
const sellerDashboardRoutes = require('./routes/sellerDashboard');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminOrderRoutes = require('./routes/adminOrders');
const sellerOrderRoutes = require('./routes/sellerOrders');

const sessionKnex = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: {
            rejectUnauthorized: false,
        },
    },
});

const sessionStore = new ConnectSessionKnexStore({
    knex: sessionKnex,
    tableName: 'sessions_knex',
    createTable: false,
});

const app = express();
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigin = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

const corsOptions = {
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'X-CSRF-Token',
    ],
    optionsSuccessStatus: 204,
};

/*
 * CORS
 *
 * This must run before sessions, CSRF protection,
 * and all API routes.
 */
app.use(cors(corsOptions));

/*
 * Explicit Express 5-compatible preflight handling.
 *
 * Do NOT use app.options('*', ...) here because Express 5
 * does not accept the old wildcard syntax.
 */
app.options(/.*/, cors(corsOptions));

app.use(helmet());

app.use(express.json({ limit: '20kb' }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite:
                process.env.NODE_ENV === 'production'
                    ? 'none'
                    : 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }),
);

/*
 * CSRF protection comes AFTER CORS/preflight handling.
 */
app.use(csrfSynchronisedProtection);

/*
 * Authentication
 */
app.use('/api/auth', authRoutes);

/*
 * Seller applications
 */
app.use(
    '/api/seller-applications',
    sellerApplicationRoutes,
);

app.use(
    '/api/admin/seller-applications',
    adminSellerApplicationRoutes,
);

/*
 * Seller products
 */
app.use(
    '/api/seller/products',
    sellerProductRoutes,
);

/*
 * Seller dashboard
 */
app.use(
    '/api/seller/dashboard',
    sellerDashboardRoutes,
);

/*
 * Public products
 */
app.use(
    '/api/products',
    productRoutes,
);

/*
 * Orders
 */
app.use(
    '/api/orders',
    orderRoutes,
);

/*
 * Admin orders
 */
app.use(
    '/api/admin/orders',
    adminOrderRoutes,
);

/*
 * Seller orders
 */
app.use(
    '/api/seller/orders',
    sellerOrderRoutes,
);

/*
 * Health check
 */
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            success: true,
            message: 'Campus Store backend and database are connected',
        });
    } catch (error) {
        console.error('Database connection failed:', error);

        res.status(500).json({
            success: false,
            message: 'Database connection failed',
        });
    }
});

/*
 * Start server
 */
app.listen(PORT, '0.0.0.0', () => {
    console.log(
        `Campus Store backend running on 0.0.0.0:${PORT}`,
    );
});