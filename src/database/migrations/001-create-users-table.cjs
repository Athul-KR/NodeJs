'use strict';

/**
 * sequelize-cli migration. Run with `npm run migrate`; undo the most
 * recent one with `npm run migrate:rollback`. The CLI records executed
 * migrations in a `SequelizeMeta` table — same bookkeeping idea as the
 * hand-rolled runner this replaced.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'users',
            {
                id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
                user_uuid: { type: Sequelize.CHAR(36), allowNull: false, unique: true },
                first_name: { type: Sequelize.STRING(100), allowNull: false },
                last_name: { type: Sequelize.STRING(100), allowNull: false, defaultValue: '' },
                email: { type: Sequelize.STRING, allowNull: false, unique: true },
                password: { type: Sequelize.STRING, allowNull: false },
                created_at: {
                    type: 'TIMESTAMP',
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
                updated_at: {
                    type: 'TIMESTAMP',
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
                },
            },
            { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('users');
    },
};
