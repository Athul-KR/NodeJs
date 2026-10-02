import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

/**
 * Brute-force protection for the auth endpoints. Login and register are
 * the two routes attackers hammer with credential lists — nothing else
 * in the API needs limits this tight.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,                // per IP per window
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.NODE_ENV === 'test',
    message: {
        status: 'error',
        message: 'Too many attempts, please try again later',
    },
});
