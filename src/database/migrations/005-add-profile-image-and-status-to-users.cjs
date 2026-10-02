'use strict';

/**
 * User management fields:
 *  - profile_image: public path of the uploaded image (nullable — optional).
 *  - status: TINYINT enum-by-convention (user.constants.js):
 *      0 = inactive (cannot log in / refresh), 1 = active.
 *    Existing rows are backfilled as active.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'profile_image', {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        });
        await queryInterface.addColumn('users', 'status', {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: 1, // 0=inactive, 1=active
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'status');
        await queryInterface.removeColumn('users', 'profile_image');
    },
};
