import * as authService from './auth.service.js';

/**
 * Thin translation layer: req.body in, JSON out. Input is already
 * validated by the route's validate() middleware; errors bubble up to
 * the global error handler. Notice there is no try/catch anywhere.
 */

export const register = async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json({ status: 'success', data: result });
};

export const login = async (req, res) => {
    const result = await authService.login(req.body);
    res.json({ status: 'success', data: result });
};

export const refresh = async (req, res) => {
    const result = await authService.refresh(req.body);
    res.json({ status: 'success', data: result });
};

export const logout = async (req, res) => {
    await authService.logout(req.body);
    res.json({ status: 'success', message: 'Logged out' });
};
