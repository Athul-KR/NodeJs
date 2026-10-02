import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { uploadProductImage } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { USER_TYPES } from '../users/user.constants.js';
import {
    createProductSchema,
    updateProductSchema,
    productKeyParamsSchema,
    listProductsQuerySchema,
} from './product.validation.js';
import * as productController from './product.controller.js';

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(listProductsQuerySchema, 'query'),
    productController.list,
);

router.post(
    '/',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    uploadProductImage,
    validate(createProductSchema),
    productController.create,
);

router.patch(
    '/:productKey',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    uploadProductImage,
    validate(productKeyParamsSchema, 'params'),
    validate(updateProductSchema),
    productController.update,
);

router.delete(
    '/:productKey',
    authenticate,
    authorize(USER_TYPES.ADMIN),
    validate(productKeyParamsSchema, 'params'),
    productController.remove,
);

export default router;
