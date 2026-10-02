import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database.js';

/**
 * Category table mapping. Products store category_id against this id, so the
 * id is part of the public API for assignment/filtering.
 */
export class Category extends Model {}

Category.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        category_name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        created_at: { type: DataTypes.DATE },
        updated_at: { type: DataTypes.DATE },
    },
    {
        sequelize,
        tableName: 'categories',
        timestamps: false,
    },
);
