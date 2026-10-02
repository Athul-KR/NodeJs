import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { mergeListFilters } from '../../middlewares/mergeListFilters.js';
import { validate } from '../../middlewares/validate.js';
import { uploadProfileImage } from '../../middlewares/upload.js';
import { USER_TYPES } from './user.constants.js';
import {
    createUserSchema,
    updateUserSchema,
    updateProfileSchema,
    updateStatusSchema,
    userUuidParamsSchema,
    listUsersQuerySchema,
} from './user.validation.js';
import * as userController from './user.controller.js';

const router = express.Router();

// GET /api/users/me — any authenticated user
router.get('/me', authenticate, userController.me);

// PATCH /api/users/me — self-service profile edit (everything EXCEPT email;
// user_type/status are stripped). MUST be registered before '/:userUuid',
// or Express would capture "me" as a uuid param and 422 it.
router.patch(
    '/me',
    authenticate,
    uploadProfileImage,
    validate(updateProfileSchema),
    userController.updateMe,
);

// Listing is open to ANY authenticated user (no authorize gate — dropped
// deliberately); create/update/status below stay ADMIN-ONLY.
// Middleware order matters: authenticate → authorize → upload (multipart
// must be parsed before req.body exists) → validate → controller.

// GET /api/users?page=&limit=&search=&status=&user_type=
router.get(
    '/',
    authenticate,
    mergeListFilters, 
    validate(listUsersQuerySchema, 'listFilters'),
    userController.list,
);

// POST /api/users/list — same filters as GET /, but accepted in the body
router.post(
    '/list',
    authenticate,
    mergeListFilters,
    validate(listUsersQuerySchema, 'listFilters'),
    userController.list,
);


// POST /api/users — multipart/form-data (optional file field: profile_image)
router.post(
    '/',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    uploadProfileImage,
    validate(createUserSchema),
    userController.create,
);

// PATCH /api/users/:userUuid — partial update, same optional file field
router.patch(
    '/:userUuid',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    uploadProfileImage,
    validate(userUuidParamsSchema, 'params'),
    validate(updateUserSchema),
    userController.update,
);

// PATCH /api/users/:userUuid/status — { status: 0 | 1 }
router.patch(
    '/:userUuid/status',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(userUuidParamsSchema, 'params'),
    validate(updateStatusSchema),
    userController.updateStatus,
);

export default router;
