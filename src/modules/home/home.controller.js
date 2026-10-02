import * as homeService from './home.service.js';

export const home = async (req, res) => {
    const result = await homeService.getHomeData(req.user?.user_uuid ?? null);
    res.json({ status: 'success', data: result });
};
