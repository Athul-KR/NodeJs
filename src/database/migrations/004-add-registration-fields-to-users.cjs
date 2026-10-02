'use strict';

/**
 * Registration fields v2: phone number + user type.
 *
 * user_type is a TINYINT enum-by-convention (see users/user.constants.js):
 *   1 = admin, 2 = user, 3 = customer
 * Existing rows are backfilled as regular users (2).
 *
 * confirm_password is deliberately NOT a column — it exists only in the
 * registration payload, checked by the validation layer and never stored.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'phone_number', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: '', // backfills existing rows
        });
        await queryInterface.addColumn('users', 'user_type', {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: 2, // 1=admin, 2=user, 3=customer
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'user_type');
        await queryInterface.removeColumn('users', 'phone_number');
    },
};
