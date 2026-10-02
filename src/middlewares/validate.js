/**
 * Validation at the edge: reject bad input BEFORE the controller runs.
 *
 * Usage in a route file:
 *   router.post('/register', validate(registerSchema), authController.register);
 *   router.get('/', validate(listQuerySchema, 'query'), controller.list);
 *   router.patch('/:userUuid', validate(paramsSchema, 'params'), controller.update);
 *
 * Where the parsed (stripped, coerced) result lands:
 *  - body   → replaces req.body, as before.
 *  - query / params → req.validated.query / req.validated.params, because
 *    Express 5 made req.query a read-only getter — assigning to it throws.
 * Controllers read the validated copy, never the raw input.
 */
import { discardUploadedFile } from './upload.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
        // If multer already stored an upload, this request failed after it —
        // reap the file so rejected requests don't litter uploads/.
        discardUploadedFile(req);
        return res.status(422).json({
            status: 'error',
            message: 'Validation failed',
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join('.') || source,
                message: issue.message,
            })),
        });
    }

    if (source === 'body') {
        req.body = result.data;
    } else {
        req.validated = { ...(req.validated ?? {}), [source]: result.data };
    }
    next();
};
