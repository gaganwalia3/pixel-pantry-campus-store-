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
    },
});

const sessionStore = new ConnectSessionKnexStore({
    knex: sessionKnex,
    tableName: 'sessions_knex',
    createTable: false,
});

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    }),
);

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
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }),
);

app.use(csrfSynchronisedProtection);

app.use('/api/auth', authRoutes);

app.use('/api/seller-applications', sellerApplicationRoutes);

app.use(
    '/api/admin/seller-applications',
    adminSellerApplicationRoutes,
);

app.use('/api/seller/products', sellerProductRoutes);

app.use(
    '/api/seller/dashboard',
    sellerDashboardRoutes,
);

app.use('/api/products', productRoutes);

app.use('/api/orders', orderRoutes);

app.use(
    '/api/admin/orders',
    adminOrderRoutes,
);

app.use(
    '/api/seller/orders',
    sellerOrderRoutes,
);

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

app.listen(PORT, () => {
    console.log(`Campus Store backend running on http://localhost:${PORT}`);
});