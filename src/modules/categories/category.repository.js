import { Op } from 'sequelize';
import { Category } from './category.model.js';

export const findById = (id) => Category.findByPk(id);

export const findByName = (categoryName) =>
    Category.findOne({ where: { category_name: categoryName } });

export const create = ({ category_name, description }) =>
    Category.create({
        category_name,
        description: description ?? null,
    });

export const updateById = (id, fields) => Category.update(fields, { where: { id } });

export const deleteById = (id) => Category.destroy({ where: { id } });

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

export const findAndCountAll = ({ search, limit, offset }) => {
    const where = {};
    if (search) {
        where.category_name = { [Op.like]: `%${escapeLike(search)}%` };
    }

    return Category.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
    });
};
