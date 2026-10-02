import { z } from 'zod';
import { PRODUCT_STATUS } from './product.constants.js';

const statusSchema = z.coerce
    .number()
    .int()
    .refine((v) => Object.values(PRODUCT_STATUS).includes(v), 'status must be 0 or 1');

const priceSchema = z
    .union([z.string(), z.number()])
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(String(v)), 'price can have at most 2 decimal places')
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), 'price must be a valid number')
    .refine((v) => v >= 0, 'price must be 0 or greater')
    .refine((v) => v <= 99999999.99, 'price is too large');

export const createProductSchema = z.object({
    product_name: z.string().trim().min(1, 'Product name is required').max(150),
    description: z.string().trim().max(2000).optional().default(''),
    category_id: z.coerce.number().int().min(1, 'Invalid category_id'),
    price: priceSchema,
    status: statusSchema.optional().default(PRODUCT_STATUS.ACTIVE),
});

export const updateProductSchema = z.object({
    product_name: z.string().trim().min(1, 'Product name is required').max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    category_id: z.coerce.number().int().min(1, 'Invalid category_id').optional(),
    price: priceSchema.optional(),
    status: statusSchema.optional(),
});

export const productKeyParamsSchema = z.object({
    productKey: z.string().uuid('Invalid product key'),
});

export const listProductsQuerySchema = z.object({
    page: z.coerce.number().int().min(1, 'page must be 1 or greater').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'limit must be between 1 and 100').default(10),
    search: z.string().trim().min(1).max(100).optional(),
    status: statusSchema.optional(),
    category_id: z.coerce.number().int().min(1, 'Invalid category_id').optional(),
});
