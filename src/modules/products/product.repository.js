import { Op } from 'sequelize';
import { Category } from '../categories/category.model.js';
import { Product } from './product.model.js';

/** Every read includes the owning category (id, name, description). */
const categoryInclude = {
    model: Category,
    as: 'category',
    attributes: ['id', 'category_name', 'description'],
};

export const findByKey = (key) =>
    Product.findOne({
        where: { key, deleted_at: null },
        include: categoryInclude,
    });

export const create = ({ key, product_name, description, category_id, image, price, status }) =>
    Product.create({
        key,
        product_name,
        description: description ?? null,
        category_id,
        image: image ?? null,
        price,
        status,
    });

export const updateByKey = (key, fields) =>
    Product.update(fields, { where: { key, deleted_at: null } });

export const softDeleteByKey = (key) =>
    Product.update({ deleted_at: new Date() }, { where: { key, deleted_at: null } });

// Deliberately counts soft-deleted products too: they still hold their
// category_id row, so the FK (RESTRICT) would block a hard category delete
// anyway — this check must agree with the constraint. Don't add deleted_at.
export const countByCategoryId = (categoryId) =>
    Product.count({ where: { category_id: categoryId } });

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

export const findAndCountAll = ({ search, status, categoryId, limit, offset }) => {
    const where = { deleted_at: null };
    if (status !== undefined) where.status = status;
    if (categoryId !== undefined) where.category_id = categoryId;
    if (search) {
        where.product_name = { [Op.like]: `%${escapeLike(search)}%` };
    }

    return Product.findAndCountAll({
        where,
        include: categoryInclude,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
    });
};
