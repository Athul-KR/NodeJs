'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'categories',
            {
                id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
                category_name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
                description: { type: Sequelize.TEXT, allowNull: true },
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
        await queryInterface.dropTable('categories');
    },
};
