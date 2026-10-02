import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { Category } from '../categories/category.model.js';
import { PRODUCT_STATUS } from './product.constants.js';

export class Product extends Model {}

Product.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        key: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
        product_name: { type: DataTypes.STRING(150), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        category_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        image: { type: DataTypes.STRING, allowNull: true },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        status: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: PRODUCT_STATUS.ACTIVE,
        },
        created_at: { type: DataTypes.DATE },
        updated_at: { type: DataTypes.DATE },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
        sequelize,
        tableName: 'products',
        timestamps: false,
    },
);

Product.belongsTo(Category, {
    foreignKey: 'category_id',
    as: 'category',
});
