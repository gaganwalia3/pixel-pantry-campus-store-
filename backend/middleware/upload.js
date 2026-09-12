const multer = require('multer');

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const imageUpload = multer({
    storage,

    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
    },

    fileFilter: (req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            return callback(
                new Error(
                    'Only JPEG, PNG, and WebP images are allowed',
                ),
            );
        }

        callback(null, true);
    },
});

module.exports = {
    imageUpload,
    MAX_IMAGE_SIZE,
};