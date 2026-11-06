
const crypto = require('crypto');
const db = require('../db');
const { sendEmail } = require('./brevoEmail');

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MINUTES = 60;

function getOtpSecret() {
    const secret = process.env.OTP_HASH_SECRET;

    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
        throw new Error(
            'OTP_HASH_SECRET must be configured with at least 32 bytes'
        );
    }

    return secret;
}

function createOtp() {
    return crypto.randomInt(0, 1_000_000)
        .toString()
        .padStart(6, '0');
}

function createChallengeId() {
    return crypto.randomBytes(32).toString('base64url');
}

function hashChallengeId(challengeId) {
    return crypto.createHash('sha256').update(challengeId).digest();
}

function hashOtp({ challengeId, userId, purpose, otp }) {
    return crypto
        .createHmac('sha256', getOtpSecret())
        .update(challengeId)
        .update(':')
        .update(userId.toString('hex'))
        .update(':')
        .update(purpose)
        .update(':')
        .update(otp)
        .digest();
}

function safeEqual(left, right) {
    return (
        Buffer.isBuffer(left) &&
        Buffer.isBuffer(right) &&
        left.length === right.length &&
        crypto.timingSafeEqual(left, right)
    );
}

function otpError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function withTransaction(callback) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const result = await callback(connection);

        await connection.commit();

        return result;
    } catch (error) {
        try {
            await connection.rollback();
        } catch {
            // Preserve the original error.
        }

        throw error;
    } finally {
        connection.release();
    }
}

async function lockOtpState(connection, userId) {
    await connection.execute(
        `INSERT INTO auth_email_otp_state (user_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
        [userId]
    );

    const [rows] = await connection.execute(
        `SELECT *
     FROM auth_email_otp_state
     WHERE user_id = ?
     FOR UPDATE`,
        [userId]
    );

    return rows[0];
}

function assertNotLocked(state) {
    if (
        state.locked_until &&
        new Date(state.locked_until).getTime() > Date.now()
    ) {
        throw otpError(
            'Too many incorrect codes. Try again later.',
            429
        );
    }
}

function getSendWindow(state) {
    const now = Date.now();

    const windowStart = state.send_window_started_at
        ? new Date(state.send_window_started_at).getTime()
        : 0;

    if (now - windowStart >= 60 * 60 * 1000) {
        return {
            sends: 0,
            startedAt: new Date(),
        };
    }

    return {
        sends: Number(state.sends_in_window || 0),
        startedAt: state.send_window_started_at,
    };
}

function assertSendAllowed(state) {
    assertNotLocked(state);

    if (
        state.last_sent_at &&
        Date.now() - new Date(state.last_sent_at).getTime() <
        RESEND_COOLDOWN_SECONDS * 1000
    ) {
        throw otpError(
            'Please wait before requesting another code.',
            429
        );
    }

    const window = getSendWindow(state);

    if (window.sends >= MAX_SENDS_PER_HOUR) {
        throw otpError(
            'Too many codes requested. Try again later.',
            429
        );
    }

    return window;
}

async function recordSend(connection, userId, window) {
    await connection.execute(
        `UPDATE auth_email_otp_state
     SET sends_in_window = ?,
         send_window_started_at = ?,
         last_sent_at = NOW(6)
     WHERE user_id = ?`,
        [window.sends + 1, window.startedAt, userId]
    );
}

function buildEmail(otp) {
    return {
        subject: 'Your Super Campus verification code',

        textContent:
            `Your Super Campus verification code is ${otp}. ` +
            `It expires in ${OTP_TTL_MINUTES} minutes. ` +
            'If you did not request this code, you can ignore this email.',

        htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Super Campus verification</h2>
        <p>Use this code to continue:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px">
          ${otp}
        </p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `,
    };
}

/**
 * Starts a new OTP challenge.
 *
 * userId must be the raw 16-byte BINARY(16) user ID from MySQL.
 * For LOGIN, the caller must validate the password before calling this.
 */
async function issueOtp({ userId, email, purpose }) {
    if (!Buffer.isBuffer(userId) || userId.length !== 16) {
        throw new TypeError('userId must be a 16-byte Buffer');
    }

    if (!['LOGIN', 'REGISTER'].includes(purpose)) {
        throw new TypeError('Invalid OTP purpose');
    }

    const challengeId = createChallengeId();
    const otp = createOtp();

    const challengeIdHash = hashChallengeId(challengeId);

    const otpHash = hashOtp({
        challengeId,
        userId,
        purpose,
        otp,
    });

    await withTransaction(async (connection) => {
        const state = await lockOtpState(connection, userId);
        const sendWindow = assertSendAllowed(state);

        await connection.execute(
            `DELETE FROM auth_email_otp_challenges
       WHERE user_id = ?`,
            [userId]
        );

        await connection.execute(
            `INSERT INTO auth_email_otp_challenges
         (challenge_id_hash, user_id, purpose, otp_hash, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(6), INTERVAL ? MINUTE))`,
            [
                challengeIdHash,
                userId,
                purpose,
                otpHash,
                OTP_TTL_MINUTES,
            ]
        );

        await recordSend(connection, userId, sendWindow);
    });

    // Send only after the database transaction commits.
    await sendEmail({
        to: email,
        ...buildEmail(otp),
    });

    return {
        challengeId,
        expiresInSeconds: OTP_TTL_MINUTES * 60,
    };
}

/**
 * Resends a code for the same challenge.
 * The challenge ID stays stable; only the OTP and expiry change.
 */
async function resendOtp({ challengeId }) {
    if (
        typeof challengeId !== 'string' ||
        challengeId.length < 32
    ) {
        throw otpError(
            'Invalid or expired verification request.'
        );
    }

    const challengeIdHash = hashChallengeId(challengeId);
    const otp = createOtp();

    const result = await withTransaction(async (connection) => {
        const [challengeRows] = await connection.execute(
            `SELECT challenge_id_hash, user_id, purpose, expires_at
       FROM auth_email_otp_challenges
       WHERE challenge_id_hash = ?
       FOR UPDATE`,
            [challengeIdHash]
        );

        const challenge = challengeRows[0];

        if (!challenge) {
            throw otpError(
                'Invalid or expired verification request.'
            );
        }

        const state = await lockOtpState(
            connection,
            challenge.user_id
        );

        const sendWindow = assertSendAllowed(state);

        const [userRows] = await connection.execute(
            `SELECT email, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
            [challenge.user_id]
        );

        const user = userRows[0];

        if (!user || !user.is_active) {
            throw otpError(
                'Invalid or expired verification request.'
            );
        }

        const otpHash = hashOtp({
            challengeId,
            userId: challenge.user_id,
            purpose: challenge.purpose,
            otp,
        });

        await connection.execute(
            `UPDATE auth_email_otp_challenges
       SET otp_hash = ?,
           expires_at = DATE_ADD(NOW(6), INTERVAL ? MINUTE)
       WHERE challenge_id_hash = ?`,
            [
                otpHash,
                OTP_TTL_MINUTES,
                challengeIdHash,
            ]
        );

        await recordSend(
            connection,
            challenge.user_id,
            sendWindow
        );

        return {
            email: user.email,
        };
    });

    await sendEmail({
        to: result.email,
        ...buildEmail(otp),
    });

    return {
        expiresInSeconds: OTP_TTL_MINUTES * 60,
    };
}

/**
 * Verifies the OTP, marks the email verified, and consumes the challenge.
 * Returns the user only after the transaction successfully commits.
 */
async function verifyOtp({ challengeId, otp }) {
    if (
        typeof challengeId !== 'string' ||
        challengeId.length < 32 ||
        typeof otp !== 'string' ||
        !/^\d{6}$/.test(otp)
    ) {
        throw otpError(
            'Invalid or expired verification code.'
        );
    }

    const challengeIdHash = hashChallengeId(challengeId);

    const result = await withTransaction(async (connection) => {
        const [challengeRows] = await connection.execute(
            `SELECT challenge_id_hash, user_id, purpose, otp_hash, expires_at
       FROM auth_email_otp_challenges
       WHERE challenge_id_hash = ?
       FOR UPDATE`,
            [challengeIdHash]
        );

        const challenge = challengeRows[0];

        if (!challenge) {
            throw otpError(
                'Invalid or expired verification code.'
            );
        }
        

        const state = await lockOtpState(
            connection,
            challenge.user_id
        );

        assertNotLocked(state);

        if (
            new Date(challenge.expires_at).getTime() <= Date.now()
        ) {
            await connection.execute(
                `DELETE FROM auth_email_otp_challenges
         WHERE challenge_id_hash = ?`,
                [challengeIdHash]
            );

            return {
                invalid: true,
            };
        }

        const suppliedHash = hashOtp({
            challengeId,
            userId: challenge.user_id,
            purpose: challenge.purpose,
            otp,
        });

        if (!safeEqual(suppliedHash, challenge.otp_hash)) {
            const windowStart = state.attempt_window_started_at
                ? new Date(state.attempt_window_started_at).getTime()
                : 0;

            const isWindowExpired =
                Date.now() - windowStart >=
                ATTEMPT_WINDOW_MINUTES * 60 * 1000;

            const failedAttempts = isWindowExpired
                ? 1
                : Number(state.failed_attempts || 0) + 1;

            const attemptWindowStartedAt = isWindowExpired
                ? new Date()
                : state.attempt_window_started_at;

            const lockedUntil =
                failedAttempts >= MAX_FAILED_ATTEMPTS
                    ? new Date(
                        Date.now() +
                        ATTEMPT_WINDOW_MINUTES * 60 * 1000
                    )
                    : null;

            await connection.execute(
                `UPDATE auth_email_otp_state
         SET failed_attempts = ?,
             attempt_window_started_at = ?,
             locked_until = ?
         WHERE user_id = ?`,
                [
                    failedAttempts,
                    attemptWindowStartedAt,
                    lockedUntil,
                    challenge.user_id,
                ]
            );

            return {
                invalid: true,
                locked: failedAttempts >= MAX_FAILED_ATTEMPTS,
            };
        }

        const [userRows] = await connection.execute(
            `SELECT id, name, email, role, is_active
       FROM users
       WHERE id = ?
       FOR UPDATE`,
            [challenge.user_id]
        );

        const user = userRows[0];

        if (!user || !user.is_active) {
            await connection.execute(
                `DELETE FROM auth_email_otp_challenges
         WHERE challenge_id_hash = ?`,
                [challengeIdHash]
            );

            return {
                invalid: true,
            };
        }

        await connection.execute(
            `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, NOW(6))
       WHERE id = ?`,
            [challenge.user_id]
        );

        await connection.execute(
            `DELETE FROM auth_email_otp_challenges
       WHERE challenge_id_hash = ?`,
            [challengeIdHash]
        );

        await connection.execute(
            `UPDATE auth_email_otp_state
       SET failed_attempts = 0,
           attempt_window_started_at = NULL,
           locked_until = NULL
       WHERE user_id = ?`,
            [challenge.user_id]
        );

        return {
            user: {
                id: user.id.toString('hex'),
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    });

    if (result.invalid) {
        throw otpError(
            result.locked
                ? 'Too many incorrect codes. Try again later.'
                : 'Invalid or expired verification code.',
            result.locked ? 429 : 400
        );
    }

    return result.user;
}

module.exports = {
    issueOtp,
    resendOtp,
    verifyOtp,
};
