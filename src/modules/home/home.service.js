import { AppError } from '../../shared/AppError.js';
import * as productRepository from '../products/product.repository.js';
import * as cartRepository from '../carts/cart.repository.js';
import * as userRepository from '../users/user.repository.js';
import { toPublicProduct } from '../products/product.service.js';
import { toPublicUser } from '../users/user.service.js';
import { PRODUCT_STATUS } from '../products/product.constants.js';
import { USER_STATUS } from '../users/user.constants.js';

const LATEST_PRODUCTS_LIMIT = 5;

/**
 * One aggregate for the home page, so the FE paints its first screen from a
 * single request instead of stitching products + counts itself.
 *
 * userUuid is null for guests: they get the catalog numbers only, and
 * `user` stays null. A uuid means the JWT verified, but stateless tokens
 * outlive account changes — so existence/active are re-checked here, same
 * errors as the cart module, and the FE reacts by dropping its tokens.
 */
export const getHomeData = async (userUuid) => {
    // The repository already orders by created_at DESC, so the first page
    // IS "the latest" — and findAndCountAll gives the total in the same call.
    const { rows, count } = await productRepository.findAndCountAll({
        status: PRODUCT_STATUS.ACTIVE,
        limit: LATEST_PRODUCTS_LIMIT,
        offset: 0,
    });

    const data = {
        latest_products: rows.map(toPublicProduct),
        total_products: count,
        user: null,
    };

    if (!userUuid) return data;

    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.status === USER_STATUS.INACTIVE) {
        throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    data.user = {
        ...toPublicUser(user),
        cart_count: await cartRepository.countForUser(user.id),
        // No orders module exists yet. 0 keeps the FE contract stable (the
        // FE hides the tile at 0) — wire the real count here when orders land.
        order_count: 0,
    };

    return data;
};
