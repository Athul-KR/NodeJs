import { z } from 'zod';

/**
 * The cart is addressed by the PRODUCT's public key — cart row ids and
 * internal product ids never cross the API. user_id is never accepted from
 * the client at all: it always comes from the JWT (req.user), otherwise any
 * caller could write into someone else's cart.
 */
export const addToCartSchema = z.object({
    product_key: z.string().uuid('Invalid product key'),
});

// DELETE /api/cart/:productKey — same public address, but in the URL.
export const cartItemParamsSchema = z.object({
    productKey: z.string().uuid('Invalid product key'),
});
