require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_NAME = 'campus_store_schema_migrations';
const MIGRATION_LOCK_TIMEOUT_SECONDS = 30;

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function createMigrationPool() {
    return mysql.createPool({
        host: requireEnv('DB_HOST'),
        port: Number(requireEnv('DB_PORT')),
        database: requireEnv('DB_NAME'),
        user: requireEnv('DB_MIGRATION_USER'),
        password: requireEnv('DB_MIGRATION_PASSWORD'),

        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0,

        // Migration SQL files may contain multiple CREATE/ALTER statements.
        // This pool is used only by the dedicated migration account.
        multipleStatements: true,
    });
}

function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }

    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => /^\d+_.+\.sql$/i.test(file))
        .sort((a, b) => {
            const versionA = Number(a.match(/^\d+/)[0]);
            const versionB = Number(b.match(/^\d+/)[0]);

            return versionA - versionB;
        });
}

function getMigrationVersion(filename) {
    return Number(filename.match(/^\d+/)[0]);
}

function getMigrationChecksum(content) {
    return crypto
        .createHash('sha256')
        .update(content, 'utf8')
        .digest('hex');
}

async function ensureMigrationTable(connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT UNSIGNED NOT NULL,
            name VARCHAR(255) NOT NULL,
            checksum CHAR(64) NOT NULL,
            applied_at TIMESTAMP(6) NOT NULL
                DEFAULT CURRENT_TIMESTAMP(6),

            PRIMARY KEY (version),
            UNIQUE KEY uq_schema_migrations_name (name)
        )
    `);
}

async function getAppliedMigrations(connection) {
    const [rows] = await connection.query(`
        SELECT
            version,
            name,
            checksum,
            applied_at
        FROM schema_migrations
        ORDER BY version ASC
    `);

    return rows;
}

async function acquireMigrationLock(connection) {
    const [rows] = await connection.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [
            MIGRATION_LOCK_NAME,
            MIGRATION_LOCK_TIMEOUT_SECONDS,
        ],
    );

    if (!rows[0] || rows[0].acquired !== 1) {
        throw new Error(
            `Could not acquire database migration lock within ${MIGRATION_LOCK_TIMEOUT_SECONDS} seconds.`,
        );
    }
}

async function releaseMigrationLock(connection) {
    await connection.query(
        'SELECT RELEASE_LOCK(?)',
        [MIGRATION_LOCK_NAME],
    );
}

async function applyMigration(connection, filename, content) {
    const version = getMigrationVersion(filename);
    const checksum = getMigrationChecksum(content);

    console.log(`Applying migration ${version}: ${filename}`);

    /*
     * MySQL DDL statements can implicitly commit.
     * Therefore migrations are intentionally not wrapped in a
     * transaction and are treated as atomic only at the migration-file level.
     */
    await connection.query(content);

    await connection.query(
        `
            INSERT INTO schema_migrations (
                version,
                name,
                checksum
            )
            VALUES (?, ?, ?)
        `,
        [
            version,
            filename,
            checksum,
        ],
    );

    console.log(`Applied migration ${version}: ${filename}`);
}

async function baselineMigration(connection, filename, content) {
    const version = getMigrationVersion(filename);
    const checksum = getMigrationChecksum(content);

    console.log(`Baselining migration ${version}: ${filename}`);

    /*
     * Baseline does NOT execute the migration SQL.
     *
     * The existing database is assumed to already contain the schema
     * represented by this baseline migration.
     */
    await connection.query(
        `
            INSERT INTO schema_migrations (
                version,
                name,
                checksum
            )
            VALUES (?, ?, ?)
        `,
        [
            version,
            filename,
            checksum,
        ],
    );

    console.log(`Baselined migration ${version}: ${filename}`);
}

async function runMigrations({ baseline = false } = {}) {
    const migrationPool = createMigrationPool();
    let connection;

    try {
        connection = await migrationPool.getConnection();

        await acquireMigrationLock(connection);

        try {
            await ensureMigrationTable(connection);

            const migrationFiles = getMigrationFiles();

            if (migrationFiles.length === 0) {
                throw new Error(
                    `No migration files found in ${MIGRATIONS_DIR}`,
                );
            }

            const appliedMigrations =
                await getAppliedMigrations(connection);

            const appliedByVersion = new Map(
                appliedMigrations.map((migration) => [
                    migration.version,
                    migration,
                ]),
            );

            for (const filename of migrationFiles) {
                const version = getMigrationVersion(filename);
                const filePath = path.join(MIGRATIONS_DIR, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const checksum = getMigrationChecksum(content);

                const applied = appliedByVersion.get(version);

                if (applied) {
                    if (applied.name !== filename) {
                        throw new Error(
                            `Migration version ${version} was previously recorded as ` +
                            `"${applied.name}" but the current file is "${filename}".`,
                        );
                    }

                    if (applied.checksum !== checksum) {
                        throw new Error(
                            `Migration checksum mismatch for ${filename}. ` +
                            `The migration file was modified after being applied.`,
                        );
                    }

                    console.log(
                        `Skipping already applied migration ${version}: ${filename}`,
                    );

                    continue;
                }

                if (baseline) {
                    await baselineMigration(
                        connection,
                        filename,
                        content,
                    );
                } else {
                    await applyMigration(
                        connection,
                        filename,
                        content,
                    );
                }

                /*
                 * Baseline only applies to the first unapplied migration.
                 * This prevents accidentally marking future migrations
                 * as already applied.
                 */
                if (baseline) {
                    break;
                }
            }

            console.log('Database migration completed successfully.');
        } finally {
            await releaseMigrationLock(connection);
        }
    } finally {
        if (connection) {
            connection.release();
        }

        await migrationPool.end();
    }
}

async function main() {
    const command = process.argv[2] || 'up';

    if (command === 'baseline') {
        await runMigrations({ baseline: true });
        return;
    }

    if (command === 'up') {
        await runMigrations({ baseline: false });
        return;
    }

    throw new Error(
        `Unknown migration command "${command}". Use "up" or "baseline".`,
    );
}

main().catch((error) => {
    console.error('Database migration failed:', error);
    process.exit(1);
});