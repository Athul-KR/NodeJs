import { z } from 'zod';

export const createCategorySchema = z.object({
    category_name: z.string().trim().min(1, 'Category name is required').max(100),
    description: z.string().trim().max(1000).optional().default(''),
});

export const updateCategorySchema = z.object({
    category_name: z.string().trim().min(1, 'Category name is required').max(100).optional(),
    description: z.string().trim().max(1000).optional(),
});

export const categoryIdParamsSchema = z.object({
    categoryId: z.coerce.number().int().min(1, 'Invalid category id'),
});

export const listCategoriesQuerySchema = z.object({
    page: z.coerce.number().int().min(1, 'page must be 1 or greater').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'limit must be between 1 and 100').default(10),
    search: z.string().trim().min(1).max(100).optional(),
});
