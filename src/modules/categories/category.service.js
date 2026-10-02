import { AppError } from '../../shared/AppError.js';
import * as categoryRepository from './category.repository.js';
import * as productRepository from '../products/product.repository.js';

const toPublicCategory = (category) => {
    const data = typeof category.toJSON === 'function' ? category.toJSON() : category;
    return data;
};

export const createCategory = async ({ category_name, description }) => {
    if (await categoryRepository.findByName(category_name)) {
        throw AppError.conflict('A category with this name already exists');
    }

    const category = await categoryRepository.create({ category_name, description });
    return { category: toPublicCategory(category) };
};

export const updateCategory = async (categoryId, data) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) throw AppError.notFound('Category not found');

    if (
        data.category_name &&
        data.category_name !== category.category_name &&
        (await categoryRepository.findByName(data.category_name))
    ) {
        throw AppError.conflict('A category with this name already exists');
    }

    const fields = {};
    for (const key of ['category_name', 'description']) {
        if (data[key] !== undefined) fields[key] = data[key];
    }

    if (Object.keys(fields).length > 0) {
        await categoryRepository.updateById(categoryId, fields);
    }

    return toPublicCategory(await categoryRepository.findById(categoryId));
};

export const listCategories = async ({ page, limit, search }) => {
    const { rows, count } = await categoryRepository.findAndCountAll({
        search,
        limit,
        offset: (page - 1) * limit,
    });

    return {
        categories: rows.map(toPublicCategory),
        pagination: {
            total_categories: count,
            current_page: page,
            per_page: limit,
            total_pages: Math.max(1, Math.ceil(count / limit)),
        },
    };
};

export const deleteCategory = async (categoryId) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) throw AppError.notFound('Category not found');

    if (await productRepository.countByCategoryId(categoryId)) {
        throw AppError.conflict('Category is assigned to products and cannot be deleted');
    }

    await categoryRepository.deleteById(categoryId);
};
