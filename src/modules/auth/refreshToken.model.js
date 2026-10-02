import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { User } from '../users/user.model.js';

export class RefreshToken extends Model {}

RefreshToken.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        // SHA-256 of the token the client holds — the plaintext is never stored.
        token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        // Set on rotation/logout instead of deleting the row: a revoked token
        // that shows up again is the reuse (= theft) tripwire.
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE },
    },
    {
        sequelize,
        tableName: 'refresh_tokens',
        timestamps: false, // created_at filled by MySQL default
    },
);

// Associations replace the hand-written JOIN: include: 'user' on a query
// makes Sequelize fetch the owning user alongside the token.
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
