import app from './app.js';
import { config } from './config/index.js';
import { connectDB, sequelize } from './config/database.js';
import { logger } from './shared/logger.js';
import { purgeExpiredTokens } from './modules/auth/auth.service.js';

try {
    await connectDB();
    logger.info('Database connected');
} catch (error) {
    logger.error({ err: error }, 'Database connection failed');
    process.exit(1);
}

const server = app.listen(config.PORT, () => {
    logger.info(`Server running on http://localhost:${config.PORT}`);
});

// Housekeeping: sweep expired refresh tokens once at boot, then daily.
// (Revoked rows double as reuse tripwires, but only need to live until the
// token expires — after that nothing can ever present it validly again.)
// .unref() keeps this timer from holding the process open during shutdown.
const purge = async () => {
    try {
        const removed = await purgeExpiredTokens();
        if (removed > 0) logger.info(`Purged ${removed} expired refresh token(s)`);
    } catch (error) {
        logger.error({ err: error }, 'Refresh-token purge failed');
    }
};
purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();

// Graceful shutdown: stop accepting requests, then release DB connections.
const shutdown = () => {
    logger.info('Shutting down…');
    server.close(async () => {
        await sequelize.close();
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
