'use strict';

const bcrypt = require('bcrypt');
const crypto = require('node:crypto');

/**
 * Bootstrap admin. Registration deliberately refuses user_type 1, so the
 * first admin has to come from outside the API — this seeder is that door.
 * Run with `npm run seed`. Idempotent: skips if the email already exists.
 *
 * DEV CREDENTIALS — change the password immediately in any real deployment:
 *   admin@example.com / Admin@12345
 */
const ADMIN_EMAIL = 'admin@example.com';

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            'SELECT id FROM users WHERE email = ?',
            { replacements: [ADMIN_EMAIL] },
        );
        if (rows.length > 0) return;

        await queryInterface.bulkInsert('users', [{
            user_uuid: crypto.randomUUID(),
            first_name: 'Admin',
            last_name: '',
            email: ADMIN_EMAIL,
            password: await bcrypt.hash('Admin@12345', 10),
            phone_number: '0000000000',
            user_type: 1, // admin
            status: 1,    // active
        }]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('users', { email: ADMIN_EMAIL });
    },
};
