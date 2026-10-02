// Database config for sequelize-cli (migrations run outside the app,
// so the CLI reads .env itself). .cjs because the CLI loads it via require.
require('dotenv').config();

const base = {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
};

module.exports = {
    development: base,
    test: base,
    production: base,
};
