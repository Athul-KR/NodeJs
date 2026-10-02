import { Cart } from './cart.model.js';
import { Product } from '../products/product.model.js';
import { Category } from '../categories/category.model.js';
import { CART_STATUS } from './cart.constants.js';

/** Embedded product shape for cart rows (with its category). */
const productInclude = {
    model: Product,
    as: 'product',
    include: [{ model: Category, as: 'category', attributes: ['id', 'category_name'] }],
};

export const findCartItem = (userId, productId) =>
    Cart.findOne({ where: { user_id: userId, product_id: productId } });

/** Highest order_by in this user's cart (null when the cart is empty). */
export const maxOrderBy = (userId) => Cart.max('order_by', { where: { user_id: userId } });

export const insert = ({ userId, productId, orderBy }) =>
    Cart.create({ user_id: userId, product_id: productId, order_by: orderBy });

export const findByIdWithProduct = (id) => Cart.findByPk(id, { include: productInclude });

/**
 * The user's active cart, in order_by order. required:true + the deleted_at
 * filter drop rows whose product was soft-deleted since it was added.
 */
export const findAllForUser = (userId) =>
    Cart.findAll({
        where: { user_id: userId, status: CART_STATUS.ACTIVE },
        include: { ...productInclude, required: true, where: { deleted_at: null } },
        order: [['order_by', 'ASC'], ['id', 'ASC']],
    });

/**
 * Hard DELETE, not a status flip: the unique (user_id, product_id) index
 * would otherwise block the product from ever being re-added. Returns the
 * number of rows removed (0 = wasn't in the cart).
 */
export const deleteCartItem = (userId, productId) =>
    Cart.destroy({ where: { user_id: userId, product_id: productId } });

/** Badge count — same visibility rules as findAllForUser. */
export const countForUser = (userId) =>
    Cart.count({
        where: { user_id: userId, status: CART_STATUS.ACTIVE },
        include: { model: Product, as: 'product', required: true, where: { deleted_at: null } },
    });
