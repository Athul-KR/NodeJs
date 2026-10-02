import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { Product } from '../products/product.model.js';
import { CART_STATUS } from './cart.constants.js';

export class Cart extends Model {}

Cart.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        // Position of the item in the user's cart — assigned max+1 on insert.
        order_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        status: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: CART_STATUS.ACTIVE,
        },
        created_at: { type: DataTypes.DATE },
        updated_at: { type: DataTypes.DATE },
    },
    {
        sequelize,
        tableName: 'carts',
        timestamps: false,
    },
);

// Listing embeds the product (and, through it, the category).
Cart.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
