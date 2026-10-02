import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../shared/AppError.js';

/**
 * JWT guard for protected routes.
 *
 * Reads "Authorization: Bearer <token>", verifies the signature, and
 * attaches the token's claims as req.user — NO database hit. That is the
 * entire point of a short-lived JWT: the signature alone proves who the
 * caller is, so protected routes stay stateless and horizontally scalable.
 *
 * The trade-off is that a deleted or blocked user keeps access until their
 * current token expires — bounded by ACCESS_TOKEN_TTL (15 min). Revoking
 * their refresh tokens (authRepository.deleteAllForUser) caps it there.
 * Handlers that need fresh user data load it themselves via user_uuid.
 *
 * The TOKEN_EXPIRED code matters: it tells the client "silently call
 * /refresh and retry", whereas a plain 401 means "log in again".
 */
export const authenticate = (req, res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        throw AppError.unauthorized('Not authorized, no token');
    }

    const token = header.slice('Bearer '.length);

    let payload;
    try {
        payload = jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw AppError.unauthorized('Token expired', 'TOKEN_EXPIRED');
        }
        throw AppError.unauthorized('Not authorized, token invalid');
    }

    req.user = { user_uuid: payload.sub, user_type: payload.user_type };
    next();
};

/**
 * For endpoints that serve BOTH guests and logged-in users (the home
 * aggregate). No Authorization header → req.user = null, proceed as guest.
 * A header that IS present must still be valid: expired/garbage tokens get
 * the same 401s as authenticate, so the client's refresh-and-retry flow
 * works instead of silently rendering the logged-out view.
 */
export const authenticateOptional = (req, res, next) => {
    if (!req.headers.authorization) {
        req.user = null;
        return next();
    }
    return authenticate(req, res, next);
};
