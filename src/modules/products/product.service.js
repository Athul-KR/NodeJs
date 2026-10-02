import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/AppError.js';
import { deleteImageFile } from '../../middlewares/upload.js';
import * as categoryRepository from '../categories/category.repository.js';
import * as productRepository from './product.repository.js';
import { PRODUCT_STATUS } from './product.constants.js';

export const toPublicProduct = (product) => {
    const data = typeof product.toJSON === 'function' ? product.toJSON() : product;
    const { id, ...publicProduct } = data;
    return publicProduct;
};

const ensureCategoryExists = async (categoryId) => {
    if (!(await categoryRepository.findById(categoryId))) {
        throw AppError.badRequest('Invalid category_id');
    }
};

export const createProduct = async (data, image) => {
    await ensureCategoryExists(data.category_id);

    const productKey = uuidv4();
    await productRepository.create({
        key: productKey,
        product_name: data.product_name,
        description: data.description,
        category_id: data.category_id,
        image,
        price: data.price,
        status: data.status ?? PRODUCT_STATUS.ACTIVE,
    });

    return { product: toPublicProduct(await productRepository.findByKey(productKey)) };
};

export const updateProduct = async (productKey, data, image) => {
    const product = await productRepository.findByKey(productKey);
    if (!product) throw AppError.notFound('Product not found');

    if (data.category_id !== undefined) {
        await ensureCategoryExists(data.category_id);
    }

    const fields = {};
    for (const key of ['product_name', 'description', 'category_id', 'price', 'status']) {
        if (data[key] !== undefined) fields[key] = data[key];
    }
    if (image) {
        fields.image = image;
        deleteImageFile(product.image);
    }

    if (Object.keys(fields).length > 0) {
        await productRepository.updateByKey(productKey, fields);
    }

    return toPublicProduct(await productRepository.findByKey(productKey));
};

export const listProducts = async ({ page, limit, search, status, category_id }) => {
    const { rows, count } = await productRepository.findAndCountAll({
        search,
        status,
        categoryId: category_id,
        limit,
        offset: (page - 1) * limit,
    });

    return {
        products: rows.map(toPublicProduct),
        pagination: {
            total_products: count,
            current_page: page,
            per_page: limit,
            total_pages: Math.max(1, Math.ceil(count / limit)),
        },
    };
};

export const deleteProduct = async (productKey) => {
    const product = await productRepository.findByKey(productKey);
    if (!product) throw AppError.notFound('Product not found');

    await productRepository.softDeleteByKey(productKey);
};
