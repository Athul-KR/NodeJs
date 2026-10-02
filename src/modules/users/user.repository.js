import { Op } from 'sequelize';
import { User } from './user.model.js';

/**
 * Repository layer, now backed by Sequelize instead of raw SQL.
 * The function signatures are unchanged — which is why the services,
 * controllers, and routes did not have to change for the ORM swap.
 */

// withPassword scope: login needs the hash to bcrypt.compare against.
export const findByEmail = (email) =>
    User.scope('withPassword').findOne({ where: { email } });

// Default scope — the password never leaves the database here.
export const findByUuid = (userUuid) =>
    User.findOne({ where: { user_uuid: userUuid } });

export const create = ({ userUuid, firstName, lastName, email, passwordHash, phoneNumber, userType, profileImage }) =>
    User.create({
        user_uuid: userUuid,
        first_name: firstName,
        last_name: lastName,
        email,
        password: passwordHash,
        phone_number: phoneNumber,
        user_type: userType,
        profile_image: profileImage ?? null,
    });

/** Partial update by public uuid; caller re-fetches for the fresh row. */
export const updateByUuid = (userUuid, fields) =>
    User.update(fields, { where: { user_uuid: userUuid } });

// % and _ are LIKE wildcards — escape them so searching "100%" means "100%".
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

/**
 * Paginated listing, newest first (id breaks created_at ties — several rows
 * can share the same TIMESTAMP second). Filters are exact; search is a
 * LIKE across name, email, and phone.
 */
export const findAndCountAll = ({ search, status, userType, limit, offset }) => {
    const where = {};
    if (status !== undefined) where.status = status;
    if (userType !== undefined) where.user_type = userType;
    if (search) {
        const like = { [Op.like]: `%${escapeLike(search)}%` };
        where[Op.or] = [
            { first_name: like },
            { last_name: like },
            { email: like },
            { phone_number: like },
        ];
    }

    return User.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
    });
};
