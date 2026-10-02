import { AppError } from '../shared/AppError.js';
import { logger } from '../shared/logger.js';
import { config } from '../config/index.js';
import { discardUploadedFile } from './upload.js';

/** Runs when no route matched. Registered second-to-last in app.js. */
export const notFoundHandler = (req, res, next) => {
    next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * The single place errors become HTTP responses. Registered LAST in app.js.
 * Express recognizes it as an error handler by its 4-argument signature.
 *
 * Operational AppErrors expose their message; anything unexpected is logged
 * in full but answered with a generic 500 so internals never leak.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    // A request that errored after multer stored its upload strands the
    // file — reap it. (Successful requests never reach this handler.)
    discardUploadedFile(req);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            ...(err.code && { code: err.code }),
        });
    }

    logger.error({ err, url: req.originalUrl }, 'Unhandled error');

    return res.status(500).json({
        status: 'error',
        message: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
};
