import { AppError } from '../shared/AppError.js';


// Filters may arrive in the query string OR the JSON body; normalize them
// into one object before validation. Body wins on conflicts.
export const mergeListFilters = (req, res, next) => {
    req.listFilters = { ...req.query, ...req.body };
    next();
};
