import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { addToCartSchema, cartItemParamsSchema } from './cart.validation.js';
import * as cartController from './cart.controller.js';

const router = express.Router();

// The cart is always the CALLER's own (user comes from the JWT), so any
// authenticated user may use it — no authorize() role gate here.

// GET /api/cart — my cart, in order_by order
router.get('/', authenticate, cartController.list);

// POST /api/cart — { product_key } — add a product to my cart
router.post('/', authenticate, validate(addToCartSchema), cartController.add);

// DELETE /api/cart/:productKey — remove a product from my cart
router.delete(
    '/:productKey',
    authenticate,
    validate(cartItemParamsSchema, 'params'),
    cartController.remove,
);

export default router;
