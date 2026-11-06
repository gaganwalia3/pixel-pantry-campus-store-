'use strict';

const crypto = require('node:crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_WRONG_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MINUTES = 60;
const RESEND_COOLDOWN_SECONDS = 60;

const getOtpHashSecret = () => {
    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error('SESSION_SECRET must be configured before using email OTP');
    }

    return secret;
};

const generateOtp = () =>
    crypto.randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');

const generateChallengeId = () =>
    crypto.randomBytes(32).toString('hex');

const hashOtp = ({ userId, challengeId, otp }) =>
    crypto
        .createHmac('sha256', getOtpHashSecret())
        .update(`${userId}:${challengeId}:${otp}`)
        .digest('hex');

const hashChallengeId = (challengeId) =>
    crypto
        .createHmac('sha256', getOtpHashSecret())
        .update(`challenge:${challengeId}`)
        .digest('hex');

const safeEqualHex = (left, right) => {
    if (
        typeof left !== 'string' ||
        typeof right !== 'string' ||
        left.length !== right.length
    ) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(left, 'hex'),
            Buffer.from(right, 'hex')
        );
    } catch {
        return false;
    }
};

module.exports = {
    OTP_LENGTH,
    OTP_TTL_MINUTES,
    MAX_WRONG_ATTEMPTS,
    ATTEMPT_WINDOW_MINUTES,
    RESEND_COOLDOWN_SECONDS,
    generateOtp,
    generateChallengeId,
    hashOtp,
    hashChallengeId,
    safeEqualHex,
};