'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'refresh_tokens',
            {
                id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
                user_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'CASCADE',
                },
                token: { type: Sequelize.STRING, allowNull: false },
                expires_at: { type: 'TIMESTAMP', allowNull: false },
                created_at: {
                    type: 'TIMESTAMP',
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            },
            { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        );

        await queryInterface.addIndex('refresh_tokens', ['token']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('refresh_tokens');
    },
};
