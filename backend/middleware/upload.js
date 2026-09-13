const multer = require('multer');

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

/*
 * ============================================================
 * MAGIC-BYTE VALIDATION
 * ============================================================
 *
 * Never trust file.mimetype by itself.
 *
 * The MIME type is supplied by the client and can be forged.
 * These checks inspect the actual bytes received in memory.
 */

const hasJpegSignature = (buffer) => {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    );
};

const hasPngSignature = (buffer) => {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a,
            ]),
        )
    );
};

const hasWebpSignature = (buffer) => {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString(
            'ascii',
        ) === 'RIFF' &&
        buffer.subarray(8, 12).toString(
            'ascii',
        ) === 'WEBP'
    );
};

const hasValidImageSignature = (
    mimetype,
    buffer,
) => {
    switch (mimetype) {
        case 'image/jpeg':
            return hasJpegSignature(
                buffer,
            );

        case 'image/png':
            return hasPngSignature(
                buffer,
            );

        case 'image/webp':
            return hasWebpSignature(
                buffer,
            );

        default:
            return false;
    }
};

const imageUpload = multer({
    storage,

    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
    },

    fileFilter: (
        req,
        file,
        callback,
    ) => {
        if (
            !ALLOWED_IMAGE_TYPES.has(
                file.mimetype,
            )
        ) {
            return callback(
                new Error(
                    'Only JPEG, PNG, and WebP images are allowed',
                ),
            );
        }

        callback(null, true);
    },
});

/*
 * ============================================================
 * MAGIC-BYTE MIDDLEWARE
 * ============================================================
 *
 * Must run AFTER multer has populated req.file.
 *
 * This verifies that the actual file contents match the
 * MIME type supplied by the client.
 */
const validateImageMagicBytes = (
    req,
    res,
    next,
) => {
    if (!req.file) {
        return next();
    }

    if (
        !hasValidImageSignature(
            req.file.mimetype,
            req.file.buffer,
        )
    ) {
        return res.status(400).json({
            success: false,
            message:
                'Invalid image file contents.',
        });
    }

    return next();
};

module.exports = {
    imageUpload,
    validateImageMagicBytes,
    MAX_IMAGE_SIZE,
};