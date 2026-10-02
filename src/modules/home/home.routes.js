import express from 'express';
import { authenticateOptional } from '../../middlewares/authenticate.js';
import * as homeController from './home.controller.js';

const router = express.Router();

// GET /api/home — home-page aggregate. Guests welcome: a missing token
// renders the logged-out payload, a present one must verify.
router.get('/', authenticateOptional, homeController.home);

export default router;
