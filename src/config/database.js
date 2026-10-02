import { Sequelize } from 'sequelize';
import { config } from './index.js';

/**
 * One Sequelize instance shared by the whole app. Sequelize manages its
 * own mysql2 connection pool underneath — same pooling as before, now
 * owned by the ORM.
 */
export const sequelize = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
    host: config.DB_HOST,
    dialect: 'mysql',
    logging: false,          // set to console.log to watch the SQL Sequelize generates
    pool: { max: 10 },
});

/** Boot-time health check. */
export const connectDB = () => sequelize.authenticate();
