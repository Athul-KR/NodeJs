import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/AppError.js';
import * as authRepository from './auth.repository.js';
import * as userRepository from '../users/user.repository.js';
import { toPublicUser, hashPassword } from '../users/user.service.js';
import { USER_STATUS } from '../users/user.constants.js';

/**
 * Service layer: ALL the business logic of authentication, and nothing
 * about HTTP. Functions take plain data and return plain data — which is
 * what makes them reusable (CLI scripts, jobs, tests) and unit-testable.
 */

/**
 * Only the SHA-256 digest of a refresh token is ever stored, so a leaked
 * database contains no usable session credentials. Plain SHA-256 (not
 * bcrypt) is the right tool here: the input is 64 random bytes, so there
 * is nothing for a brute-force attack to guess.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Issue a short-lived JWT + a long-lived refresh token (hash stored in DB). */
const issueTokens = async (user) => {
    // user_type rides in the claims so role checks stay signature-only,
    // matching the no-DB-hit authenticate middleware.
    const accessToken = jwt.sign(
        { sub: user.user_uuid, user_type: user.user_type },
        config.JWT_SECRET,
        { expiresIn: config.ACCESS_TOKEN_TTL },
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await authRepository.insertRefreshToken({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
    });

    return { accessToken, refreshToken };
};

// confirm_password never reaches this layer: validation checks it against
// password and it is simply not destructured here.
export const register = async ({ first_name, last_name, email, password, phone_number, user_type }) => {
    if (await userRepository.findByEmail(email)) {
        throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);

    await userRepository.create({
        userUuid: uuidv4(),
        firstName: first_name,
        lastName: last_name,
        email,
        passwordHash,
        phoneNumber: phone_number,
        userType: user_type,
    });

    const user = await userRepository.findByEmail(email);
    const tokens = await issueTokens(user);

    return { user: toPublicUser(user), ...tokens };
};

export const login = async ({ email, password }) => {
    const user = await userRepository.findByEmail(email);

    // Same message for unknown email and wrong password, so attackers
    // can't probe which emails are registered.
    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw AppError.unauthorized('Invalid credentials');
    }

    // Checked AFTER credentials so a wrong password can't probe account state.
    if (user.status === USER_STATUS.INACTIVE) {
        throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    const tokens = await issueTokens(user);
    return { user: toPublicUser(user), ...tokens };
};

/**
 * Refresh-token ROTATION with REUSE DETECTION.
 *
 * On every refresh the presented token is revoked (not deleted) and a new
 * pair is issued. If a token that was already rotated or logged out shows
 * up again, two parties hold copies — the real client and a thief — and
 * there is no telling which one this is. The only safe response is to
 * revoke every session the user has and force a fresh login.
 */
export const refresh = async ({ refreshToken }) => {
    const stored = await authRepository.findRefreshToken(hashToken(refreshToken));

    if (!stored) {
        throw AppError.unauthorized('Invalid refresh token, please log in again', 'REFRESH_TOKEN_INVALID');
    }

    if (stored.revoked_at) {
        await authRepository.deleteAllForUser(stored.user_id);
        throw AppError.unauthorized('Refresh token reuse detected — all sessions revoked, please log in again', 'REFRESH_TOKEN_REUSED');
    }

    if (stored.expires_at <= new Date()) {
        throw AppError.unauthorized('Refresh token expired, please log in again', 'REFRESH_TOKEN_INVALID');
    }

    // Deactivation revokes all tokens, but guard against a race anyway.
    if (stored.user.status === USER_STATUS.INACTIVE) {
        throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    await authRepository.revokeRefreshToken(stored.token_hash);
    return issueTokens(stored.user);
};

/** Revoke (don't delete) so the row keeps working as a reuse tripwire. */
export const logout = async ({ refreshToken }) => {
    await authRepository.revokeRefreshToken(hashToken(refreshToken));
};

/** Housekeeping, scheduled in server.js: drop rows past their expiry. */
export const purgeExpiredTokens = () => authRepository.deleteExpired();
