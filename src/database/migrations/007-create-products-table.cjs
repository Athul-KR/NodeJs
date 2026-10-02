'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'products',
            {
                id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
                key: { type: Sequelize.CHAR(36), allowNull: false, unique: true },
                product_name: { type: Sequelize.STRING(150), allowNull: false },
                description: { type: Sequelize.TEXT, allowNull: true },
                category_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,
                    references: { model: 'categories', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
                },
                image: { type: Sequelize.STRING, allowNull: true },
                price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
                status: {
                    type: Sequelize.TINYINT.UNSIGNED,
                    allowNull: false,
                    defaultValue: 1,
                },
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
                deleted_at: { type: Sequelize.DATE, allowNull: true },
            },
            { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        );

        await queryInterface.addIndex('products', ['category_id']);
        await queryInterface.addIndex('products', ['status']);
        await queryInterface.addIndex('products', ['deleted_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('products');
    },
};
