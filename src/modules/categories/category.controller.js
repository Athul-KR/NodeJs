import * as categoryService from './category.service.js';

export const create = async (req, res) => {
    const result = await categoryService.createCategory(req.body);
    res.status(201).json({ status: 'success', data: result });
};

export const update = async (req, res) => {
    const category = await categoryService.updateCategory(
        req.validated.params.categoryId,
        req.body,
    );
    res.json({ status: 'success', data: { category } });
};

export const list = async (req, res) => {
    const result = await categoryService.listCategories(req.validated.query);
    res.json({ status: 'success', data: result });
};

export const remove = async (req, res) => {
    await categoryService.deleteCategory(req.validated.params.categoryId);
    res.json({ status: 'success', message: 'Category deleted successfully' });
};
