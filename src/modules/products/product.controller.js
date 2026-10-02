import * as productService from './product.service.js';
import { publicProductImagePath } from '../../middlewares/upload.js';

export const create = async (req, res) => {
    const result = await productService.createProduct(req.body, publicProductImagePath(req.file));
    res.status(201).json({ status: 'success', data: result });
};

export const update = async (req, res) => {
    const product = await productService.updateProduct(
        req.validated.params.productKey,
        req.body,
        publicProductImagePath(req.file),
    );
    res.json({ status: 'success', data: { product } });
};

export const list = async (req, res) => {
    const result = await productService.listProducts(req.validated.query);
    res.json({ status: 'success', data: result });
};

export const remove = async (req, res) => {
    await productService.deleteProduct(req.validated.params.productKey);
    res.json({ status: 'success', message: 'Product deleted successfully' });
};
