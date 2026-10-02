import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { USER_TYPES, USER_STATUS } from './user.constants.js';

/**
 * The User model — the ORM equivalent of a hand-rolled Active Record class.
 * Sequelize maintains the mapping between this definition and the `users`
 * table; the actual table shape is owned by the migrations.
 */
export class User extends Model {}

User.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        user_uuid: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
        first_name: { type: DataTypes.STRING(100), allowNull: false },
        last_name: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        password: { type: DataTypes.STRING, allowNull: false },
        phone_number: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
        // TINYINT enum-by-convention — named in user.constants.js
        user_type: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: USER_TYPES.USER,
        },
        // Public path of the uploaded image, e.g. /uploads/profile-images/<file>
        profile_image: { type: DataTypes.STRING, allowNull: true },
        // TINYINT enum-by-convention — named in user.constants.js
        status: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: USER_STATUS.ACTIVE,
        },
        created_at: { type: DataTypes.DATE },
        updated_at: { type: DataTypes.DATE },
    },
    {
        sequelize,
        tableName: 'users',
        // created_at / updated_at are filled by MySQL defaults (see migration),
        // so Sequelize's own timestamp handling is switched off.
        timestamps: false,

        // Eloquent's $hidden = ['password'], as a real ORM feature:
        // every query excludes the hash unless a scope opts back in.
        defaultScope: { attributes: { exclude: ['password'] } },
        scopes: {
            withPassword: {}, // used only when verifying credentials
        },
    },
);
