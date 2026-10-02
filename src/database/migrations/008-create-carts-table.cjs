'use strict';

/**
 * Cart items. One row per (user, product):
 *  - the composite UNIQUE index is the hard guarantee against duplicate
 *    products in a cart — the service checks first for a friendly 409, the
 *    index catches races.
 *  - order_by keeps the user's item ordering (assigned max+1 on insert).
 *  - status: 0 = inactive, 1 = active (cart.constants.js) — listing shows
 *    active rows only.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'carts',
            {
                id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
                user_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'CASCADE',
                },
                product_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,
                    references: { model: 'products', key: 'id' },
                    onDelete: 'CASCADE',
                },
                order_by: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
                status: {
                    type: Sequelize.TINYINT.UNSIGNED,
                    allowNull: false,
                    defaultValue: 1, // 0=inactive, 1=active
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
            },
            { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        );

        await queryInterface.addIndex('carts', ['user_id', 'product_id'], { unique: true });
        await queryInterface.addIndex('carts', ['user_id', 'order_by']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('carts');
    },
};
