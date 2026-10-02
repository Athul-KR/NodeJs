import { z } from 'zod';
import { USER_TYPES, USER_STATUS } from './user.constants.js';

/**
 * Schemas for the admin user-management endpoints, plus field rules shared
 * with auth (registration uses the same phone/name definitions).
 * The profile image is NOT here — it arrives as a file, validated by the
 * upload middleware (type/size), never through req.body.
 */

const ALL_USER_TYPES = Object.values(USER_TYPES);

export const firstNameSchema = z.string().trim().min(1, 'First name is required').max(100);
export const lastNameSchema = z.string().trim().max(100).optional().default('');
export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');

// At least 7 actual digits — separators alone (e.g. "-------") don't pass.
export const phoneNumberSchema = z
    .string()
    .trim()
    .max(20, 'Phone number must be at most 20 characters')
    .regex(/^\+?[\d\s-]+$/, 'Invalid phone number')
    .refine((v) => (v.match(/\d/g) ?? []).length >= 7, 'Phone number must contain at least 7 digits');

export const createUserSchema = z.object({
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    email: emailSchema,
    phone_number: phoneNumberSchema,
    // Admins may create any type, including other admins.
    user_type: z.coerce
        .number()
        .int()
        .refine((v) => ALL_USER_TYPES.includes(v), 'user_type must be 1 (admin), 2 (user), or 3 (customer)'),
});

// PATCH semantics: every field optional, only what's present gets updated.
export const updateUserSchema = z.object({
    first_name: firstNameSchema.optional(),
    last_name: z.string().trim().max(100).optional(),
    email: emailSchema.optional(),
    phone_number: phoneNumberSchema.optional(),
    user_type: z.coerce
        .number()
        .int()
        .refine((v) => ALL_USER_TYPES.includes(v), 'user_type must be 1 (admin), 2 (user), or 3 (customer)')
        .optional(),
});

/**
 * Self-service profile edit. email is intentionally absent (immutable from
 * this endpoint), and user_type/status are never self-assignable — zod
 * strips unknown keys, so sending them is silently ignored, and the service
 * whitelists again as defense in depth.
 */
export const updateProfileSchema = z.object({
    first_name: firstNameSchema.optional(),
    last_name: z.string().trim().max(100).optional(),
    phone_number: phoneNumberSchema.optional(),
});

export const updateStatusSchema = z.object({
    status: z.coerce
        .number()
        .int()
        .refine((v) => Object.values(USER_STATUS).includes(v), 'status must be 0 (inactive) or 1 (active)'),
});

export const userUuidParamsSchema = z.object({
    userUuid: z.string().uuid('Invalid user id'),
});

// Query strings arrive as strings — z.coerce turns "2" into 2 before checks.
export const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1, 'page must be 1 or greater').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'limit must be between 1 and 100').default(10),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.coerce
        .number()
        .int()
        .refine((v) => Object.values(USER_STATUS).includes(v), 'status must be 0 or 1')
        .default(USER_STATUS.ACTIVE),
    user_type: z.coerce
        .number()
        .int()
        .refine((v) => ALL_USER_TYPES.includes(v), 'user_type must be 1, 2, or 3')
        .optional(),
});
