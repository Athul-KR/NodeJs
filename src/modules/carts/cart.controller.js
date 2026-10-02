import * as cartService from './cart.service.js';

export const add = async (req, res) => {
    const result = await cartService.addToCart(req.user.user_uuid, req.body);
    res.status(201).json({ status: 'success', data: result });
};

export const list = async (req, res) => {
    const result = await cartService.listCart(req.user.user_uuid);
    res.json({ status: 'success', data: result });
};

export const remove = async (req, res) => {
    const result = await cartService.removeFromCart(
        req.user.user_uuid,
        req.validated.params.productKey,
    );
    res.json({ status: 'success', data: result });
};
