import { AppError } from '../../shared/AppError.js';
import * as cartRepository from './cart.repository.js';
import * as userRepository from '../users/user.repository.js';
import * as productRepository from '../products/product.repository.js';
import { USER_STATUS } from '../users/user.constants.js';
import { PRODUCT_STATUS } from '../products/product.constants.js';
import { toPublicProduct } from '../products/product.service.js';

/** Cart rows hide every internal id; the product is the public address. */
const toPublicCartItem = (row) => {
    const data = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const { id, user_id, product_id, product, ...rest } = data;
    return { ...rest, product: product ? toPublicProduct(product) : null };
};

/**
 * The JWT is stateless, so "validate the user" means re-checking the DB:
 * the account must still exist and be active before its cart changes.
 */
const resolveActiveUser = async (userUuid) => {
    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.status === USER_STATUS.INACTIVE) {
        throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }
    return user;
};

export const addToCart = async (userUuid, { product_key }) => {
    const user = await resolveActiveUser(userUuid);

    // findByKey already excludes soft-deleted products.
    const product = await productRepository.findByKey(product_key);
    if (!product) throw AppError.notFound('Product not found');
    if (product.status === PRODUCT_STATUS.INACTIVE) {
        throw AppError.badRequest('Product is not available');
    }

    // Friendly 409 for duplicates; the unique (user_id, product_id) index
    // is the hard backstop if two requests race past this check.
    if (await cartRepository.findCartItem(user.id, product.id)) {
        throw AppError.conflict('Product is already in the cart');
    }

    const orderBy = ((await cartRepository.maxOrderBy(user.id)) ?? 0) + 1;
    const row = await cartRepository.insert({ userId: user.id, productId: product.id, orderBy });

    return { cart_item: toPublicCartItem(await cartRepository.findByIdWithProduct(row.id)) };
};

export const removeFromCart = async (userUuid, productKey) => {
    const user = await resolveActiveUser(userUuid);

    const product = await productRepository.findByKey(productKey);
    if (!product) throw AppError.notFound('Product not found');

    // Delete-then-check (instead of find-then-delete) so two concurrent
    // removals can't both "find" the row: exactly one sees deleted > 0.
    const deleted = await cartRepository.deleteCartItem(user.id, product.id);
    if (deleted === 0) throw AppError.notFound('Product is not in the cart');

    // Fresh count so the FE can update its badge without a second call.
    return { total_items: await cartRepository.countForUser(user.id) };
};

export const listCart = async (userUuid) => {
    const user = await resolveActiveUser(userUuid);
    const rows = await cartRepository.findAllForUser(user.id);

    return {
        cart_items: rows.map(toPublicCartItem),
        total_items: rows.length,
    };
};
