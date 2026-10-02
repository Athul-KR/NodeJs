import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { USER_TYPES } from '../users/user.constants.js';
import {
    createCategorySchema,
    updateCategorySchema,
    categoryIdParamsSchema,
    listCategoriesQuerySchema,
} from './category.validation.js';
import * as categoryController from './category.controller.js';

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(listCategoriesQuerySchema, 'query'),
    categoryController.list,
);

router.post(
    '/',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(createCategorySchema),
    categoryController.create,
);

router.patch(
    '/:categoryId',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(categoryIdParamsSchema, 'params'),
    validate(updateCategorySchema),
    categoryController.update,
);

router.delete(
    '/:categoryId',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(categoryIdParamsSchema, 'params'),
    categoryController.remove,
);

export default router;
