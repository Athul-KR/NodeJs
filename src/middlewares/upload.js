import multer from 'multer';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AppError } from '../shared/AppError.js';

const MAX_SIZE_MB = 2;

const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

const makeImageUploader = ({ dir, field, label }) => {
    fs.mkdirSync(dir, { recursive: true });

    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, dir),
            filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED_TYPES[file.mimetype]),
        }),
        limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
                console.log('FILE:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
    });
            if (!ALLOWED_TYPES[file.mimetype]) {
                return cb(AppError.badRequest(`${label} must be a JPEG, PNG, or WebP`));
            }
            cb(null, true);
        },
    }).single(field);

    return (req, res, next) =>
        upload(req, res, (err) => {
            if (!err) return next();
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(AppError.badRequest(`${label} must be ${MAX_SIZE_MB}MB or smaller`));
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return next(AppError.badRequest(`Unexpected file field - use "${field}"`));
            }
            next(err);
        });
};

/** Wraps multer so its errors become AppErrors for the global handler. */
export const uploadProfileImage = makeImageUploader({
    dir: 'uploads/profile-images',
    field: 'profile_image',
    label: 'Profile image',
});

export const uploadProductImage = makeImageUploader({
    dir: 'uploads/product-images',
    field: 'image',
    label: 'Product image',
});

/** The public URL path a stored file is served under (see app.js static). */
export const publicImagePath = (file) => (file ? `/uploads/profile-images/${file.filename}` : undefined);
export const publicProductImagePath = (file) => (file ? `/uploads/product-images/${file.filename}` : undefined);

/** Best-effort removal of a replaced image; a miss is not an error. */
export const deleteImageFile = (publicPath) => {
    if (!publicPath) return;
    fs.promises.unlink(`.${publicPath}`).catch(() => {});
};

/**
 * Multer writes the file to disk BEFORE validation and the controller run,
 * so any failure after upload (422, bad category_id, duplicate email…)
 * would strand the file forever. validate() and the global error handler
 * call this to reap it. On success nothing calls it, so the file survives.
 */
export const discardUploadedFile = (req) => {
    if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
};
