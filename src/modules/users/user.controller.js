import * as userService from './user.service.js';
import { publicImagePath } from '../../middlewares/upload.js';

/**
 * Controllers only translate HTTP ↔ domain: read from req, call one
 * service function, shape the response. No business logic, no SQL,
 * no try/catch — errors bubble to the global error handler.
 *
 * req.body is the validated body; req.validated.query / .params hold the
 * validated copies (Express 5 makes req.query read-only). req.file is
 * multer's upload, already type/size-checked.
 */

export const me = async (req, res) => {
    const profile = await userService.getProfile(req.user.user_uuid);
    res.json({ status: 'success', data: { user: profile } });
};

export const updateMe = async (req, res) => {
    const user = await userService.updateProfile(
        req.user.user_uuid,
        req.body,
        publicImagePath(req.file),
    );
    res.json({ status: 'success',message: 'User profile updated successfully', data: { user } });
};

export const create = async (req, res) => {
    const result = await userService.createUser(req.body, publicImagePath(req.file));
    res.status(201).json({ status: 'success', message: 'User created successfully', data: result });
};

export const update = async (req, res) => {
    const user = await userService.updateUser(
        req.validated.params.userUuid,
        req.body,
        publicImagePath(req.file),
    );
    res.json({ status: 'success', message: 'User updated successfully', data: { user } });
};

export const list = async (req, res) => {

    const result = await userService.listUsers(req.validated.listFilters);
    res.json({ status: 'success', message: 'Users listed successfully', data: result });
};

export const updateStatus = async (req, res) => {
    const user = await userService.setUserStatus(
        req.validated.params.userUuid,
        req.body.status,
        req.user.user_uuid,
    );
       const message =
        req.body.status === USER_STATUS.ACTIVE
            ? 'User activated successfully'
            : 'User deactivated successfully';

    res.json({ status: 'success', message: message, data: { user } });
};
