import { Op } from 'sequelize';
import { RefreshToken } from './refreshToken.model.js';

/** All refresh-token data access, via the ORM. Everything is keyed by the
 *  SHA-256 hash — the plaintext token never reaches this layer. */

export const insertRefreshToken = ({ userId, tokenHash, expiresAt }) =>
    RefreshToken.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

/**
 * The stored row for a presented token — in ANY state (valid, revoked,
 * expired) — with its owner included. The service needs to see the state
 * to tell "rotate" apart from "reuse detected" and "expired".
 */
export const findRefreshToken = (tokenHash) =>
    RefreshToken.findOne({ where: { token_hash: tokenHash }, include: 'user' });

/**
 * Soft-revoke: the row stays behind until it expires, acting as the
 * reuse tripwire. `revoked_at: null` in the WHERE keeps the original
 * revocation time if the token is revoked twice.
 */
export const revokeRefreshToken = (tokenHash) =>
    RefreshToken.update(
        { revoked_at: new Date() },
        { where: { token_hash: tokenHash, revoked_at: null } },
    );

/** Kill every session for a user (token theft, password change, "log out everywhere"). */
export const deleteAllForUser = (userId) =>
    RefreshToken.destroy({ where: { user_id: userId } });

/** Purge job: rows past expiry are dead weight — revoked rows too, since a
 *  tripwire only needs to live as long as the token could still be presented. */
export const deleteExpired = () =>
    RefreshToken.destroy({ where: { expires_at: { [Op.lt]: new Date() } } });
