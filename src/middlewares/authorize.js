import { AppError } from '../shared/AppError.js';

/**
 * Role guard — always used AFTER authenticate, which puts the JWT claims
 * on req.user. Stateless like authenticate: the user's type rides in the
 * signed token, so no DB hit here either.
 *
 * Usage:
 *   router.get('/', authenticate, authorize(USER_TYPES.ADMIN), controller.list);
 *
 * 401 = "we don't know who you are" (authenticate's job).
 * 403 = "we know exactly who you are — and you can't do this" (this one).
 *
 * Tokens issued before user_type was added to the claims have no type and
 * land here as 403 — those users just log in again.
 */
export const authorize = (...allowedTypes) => (req, res, next) => {
    if (!req.user) {
        throw AppError.unauthorized('Not authorized');
    }
    if (!allowedTypes.includes(req.user.user_type)) {
        throw AppError.forbidden('You do not have permission to perform this action');
    }
    next();
};
