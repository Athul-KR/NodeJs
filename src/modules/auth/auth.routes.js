import express from 'express';
import { validate } from '../../middlewares/validate.js';
import { authLimiter } from '../../middlewares/rateLimiters.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/auth/refresh — trade a valid refresh token for a new pair
router.post('/refresh', validate(refreshSchema), authController.refresh);

// POST /api/auth/logout — revoke the refresh token
router.post('/logout', validate(refreshSchema), authController.logout);

export default router;
