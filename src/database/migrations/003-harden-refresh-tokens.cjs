'use strict';

/**
 * Security hardening for refresh_tokens:
 *
 *  - `token` (plaintext) → `token_hash` (SHA-256 hex, always 64 chars):
 *    a leaked database no longer contains usable session credentials.
 *  - `revoked_at`: rotation now soft-revokes instead of deleting, so a
 *    rotated token that is presented again can be recognized as REUSE —
 *    the signal that a token was stolen.
 *
 * Existing rows hold plaintext tokens that can never match a hash lookup,
 * so they are cleared: every logged-in user re-logs-in after this deploys.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('refresh_tokens', null, {});

        await queryInterface.removeIndex('refresh_tokens', ['token']);
        await queryInterface.renameColumn('refresh_tokens', 'token', 'token_hash');
        await queryInterface.changeColumn('refresh_tokens', 'token_hash', {
            type: Sequelize.CHAR(64),
            allowNull: false,
        });
        await queryInterface.addIndex('refresh_tokens', ['token_hash'], { unique: true });

        await queryInterface.addColumn('refresh_tokens', 'revoked_at', {
            type: Sequelize.DATE, // DATETIME — no TIMESTAMP auto-init/update quirks
            allowNull: true,
            defaultValue: null,
        });

        // MySQL/MariaDB silently gave expires_at (the table's first TIMESTAMP
        // column without an explicit default) ON UPDATE CURRENT_TIMESTAMP.
        // Harmless while rows were only inserted/deleted — but rotation now
        // UPDATEs rows (revoked_at), which would bump expires_at to NOW and
        // let the purge job delete the reuse tripwire early. DATETIME has no
        // such magic.
        await queryInterface.changeColumn('refresh_tokens', 'expires_at', {
            type: Sequelize.DATE,
            allowNull: false,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn('refresh_tokens', 'expires_at', {
            type: 'TIMESTAMP',
            allowNull: false,
        });
        await queryInterface.removeColumn('refresh_tokens', 'revoked_at');
        await queryInterface.removeIndex('refresh_tokens', ['token_hash']);
        await queryInterface.changeColumn('refresh_tokens', 'token_hash', {
            type: Sequelize.STRING,
            allowNull: false,
        });
        await queryInterface.renameColumn('refresh_tokens', 'token_hash', 'token');
        await queryInterface.addIndex('refresh_tokens', ['token']);
    },
};
