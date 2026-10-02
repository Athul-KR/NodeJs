/**
 * Operational error with an HTTP status code.
 *
 * Throw this from anywhere (service, repository, middleware) and the
 * global error handler turns it into a proper JSON response. Controllers
 * never need try/catch — Express 5 forwards async throws automatically.
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, code = undefined) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;           // machine-readable code for API clients, e.g. 'TOKEN_EXPIRED'
        this.isOperational = true;  // "expected" error — safe to show its message to the client
    }

    static badRequest(message, code) { return new AppError(message, 400, code); }
    static unauthorized(message, code) { return new AppError(message, 401, code); }
    static forbidden(message, code) { return new AppError(message, 403, code); }
    static notFound(message, code) { return new AppError(message, 404, code); }
    static conflict(message, code) { return new AppError(message, 409, code); }
}
