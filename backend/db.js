
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const caPath = process.env.DB_SSL_CA_PATH ||
    path.join(__dirname, 'certificates', 'aiven-ca.pem');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    ssl: {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true,
    },

    timezone: 'Z',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

module.exports = pool;
