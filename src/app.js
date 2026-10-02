import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { logger } from './shared/logger.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import productRoutes from './modules/products/product.routes.js';
import cartRoutes from './modules/carts/cart.routes.js';
import homeRoutes from './modules/home/home.routes.js';

/**
 * Builds the Express app WITHOUT starting it — no .listen() here.
 * server.js starts it for real; tests import it directly into Supertest.
 */
const app = express();

// ---- Security & parsing (order matters: these run on every request) ----
app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Structured request logging (silent under test)
if (config.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
}

// ---- Health check (for uptime monitors / load balancers) ----
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Uploaded profile images (stored by middlewares/upload.js) ----
app.use('/uploads', express.static('uploads'));

// ---- Frontend (public/) — plain static files; helmet's CSP allows
// same-origin scripts only, so all JS/CSS live in their own files ----
app.use(express.static('public'));

// ---- Feature modules ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/home', homeRoutes);

// ---- Fallthrough: 404, then the single global error handler (always LAST) ----
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
