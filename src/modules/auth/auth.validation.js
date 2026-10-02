import { z } from 'zod';
import { USER_TYPES, PUBLIC_USER_TYPES } from '../users/user.constants.js';
import {
    firstNameSchema,
    lastNameSchema,
    emailSchema,
    phoneNumberSchema,
} from '../users/user.validation.js';

/**
 * One schema per endpoint. The validate() middleware runs these before
 * the controller, so everything downstream can trust the input shape.
 */

export const registerSchema = z
    .object({
        first_name: firstNameSchema,
        last_name: lastNameSchema,
        email: emailSchema,
        password: z.string().min(8, 'Password must be at least 8 characters').max(72),
        // Checked against password below, then discarded — never stored.
        confirm_password: z.string().min(1, 'Confirm password is required'),
        phone_number: phoneNumberSchema,
        // Self-registration may pick user (2) or customer (3) — never admin (1).
        user_type: z.coerce
            .number()
            .int()
            .refine((v) => PUBLIC_USER_TYPES.includes(v), 'user_type must be 2 (user) or 3 (customer)')
            .default(USER_TYPES.USER),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: 'Passwords do not match',
        path: ['confirm_password'],
    });

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});
