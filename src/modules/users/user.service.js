import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/AppError.js';
import * as userRepository from './user.repository.js';
import * as authRepository from '../auth/auth.repository.js';
import { USER_STATUS,USER_TYPE_NAMES } from './user.constants.js';
import { deleteImageFile } from '../../middlewares/upload.js';

const BCRYPT_ROUNDS = 10;

/** Single home for password hashing — auth.service imports this too. */
export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * Strip fields that must never leave the API (the bcrypt hash and the
 * internal auto-increment id — clients only ever see the public uuid).
 * Accepts a Sequelize instance or a plain object.
 */
export const toPublicUser = (user) => {
    const data = typeof user.toJSON === 'function' ? user.toJSON() : user;
    const { password, id, ...publicUser } = data;
    publicUser.user_type_name = USER_TYPE_NAMES[publicUser.user_type] ?? 'Unknown';
    return publicUser;
};

export const getProfile = async (userUuid) => {
    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
};

/**
 * Admin-created account. There is no password field in the create form, so
 * a random one is generated and returned ONCE in the response — a stand-in
 * for the invite/reset-password email a production system would send.
 */
export const createUser = async ({ first_name, last_name, email, phone_number, user_type }, profileImage) => {
    if (await userRepository.findByEmail(email)) {
        throw AppError.conflict('An account with this email already exists');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12 chars
    const userUuid = uuidv4();

    await userRepository.create({
        userUuid,
        firstName: first_name,
        lastName: last_name,
        email,
        passwordHash: await hashPassword(tempPassword),
        phoneNumber: phone_number,
        userType: user_type,
        profileImage,
    });

    const user = await userRepository.findByUuid(userUuid);
    return { user: toPublicUser(user), temp_password: tempPassword };
};

/** PATCH semantics: only the provided fields change. */
export const updateUser = async (userUuid, data, profileImage) => {
    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.notFound('User not found');

    if (data.email && data.email !== user.email && (await userRepository.findByEmail(data.email))) {
        throw AppError.conflict('An account with this email already exists');
    }

    const fields = {};
    for (const key of ['first_name', 'last_name', 'email', 'phone_number', 'user_type']) {
        if (data[key] !== undefined) fields[key] = data[key];
    }
    if (profileImage) {
        fields.profile_image = profileImage;
        deleteImageFile(user.profile_image); // replaced file is dead weight
    }

    if (Object.keys(fields).length > 0) {
        await userRepository.updateByUuid(userUuid, fields);
    }

    return toPublicUser(await userRepository.findByUuid(userUuid));
};

/**
 * Self-service profile update — identity fields only. The whitelist here is
 * deliberate defense in depth on top of updateProfileSchema: email changes,
 * self-promotion (user_type) and self-activation (status) must be impossible
 * even if the validation layer ever loosens.
 */
export const updateProfile = async (userUuid, data, profileImage) => {
    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.notFound('User not found');

    const fields = {};
    for (const key of ['first_name', 'last_name', 'phone_number']) {
        if (data[key] !== undefined) fields[key] = data[key];
    }
    if (profileImage) {
        fields.profile_image = profileImage;
        deleteImageFile(user.profile_image);
    }

    if (Object.keys(fields).length > 0) {
        await userRepository.updateByUuid(userUuid, fields);
    }

    return toPublicUser(await userRepository.findByUuid(userUuid));
};

export const listUsers = async ({ page, limit, search, status, user_type }) => {
    const { rows, count } = await userRepository.findAndCountAll({
        search,
        status,
        userType: user_type,
        limit,
        offset: (page - 1) * limit,
    });

    return {
        users: rows.map(toPublicUser),
        pagination: {
            total_users: count,
            current_page: page,
            per_page: limit,
            total_pages: Math.max(1, Math.ceil(count / limit)),
        },
    };
};

/**
 * Activate / deactivate. Deactivation also revokes every refresh token, so
 * the account is fully locked out within one access-token TTL (15 min) —
 * the JWT itself stays valid until it expires (stateless by design).
 */
export const setUserStatus = async (userUuid, status, actingUserUuid) => {
    if (status === USER_STATUS.INACTIVE && userUuid === actingUserUuid) {
        throw AppError.badRequest('You cannot deactivate your own account');
    }

    const user = await userRepository.findByUuid(userUuid);
    if (!user) throw AppError.notFound('User not found');

    await userRepository.updateByUuid(userUuid, { status });
    if (status === USER_STATUS.INACTIVE) {
        await authRepository.deleteAllForUser(user.id);
    }

    return toPublicUser(await userRepository.findByUuid(userUuid));
};
