import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { config } from '../src/config/index.js';

/**
 * Integration tests via Supertest. Because app.js never calls .listen(),
 * we can import the real app — full middleware stack included — without
 * opening a port. These cases exercise the edges that don't need MySQL:
 * validation, 404s, and the health check.
 *
 * (Tests that hit the database — register/login happy paths — belong in a
 * suite pointed at a dedicated test database. That's the next exercise.)
 */

describe('GET /health', () => {
    it('responds 200 ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});

// A body that passes every rule — each test breaks exactly one field.
const validRegisterBody = {
    first_name: 'Athul',
    last_name: 'Krishnan',
    email: 'athul@example.com',
    password: 'secret123',
    confirm_password: 'secret123',
    phone_number: '+91 98765 43210',
    user_type: 2,
};

describe('POST /api/auth/register — validation', () => {
    it('rejects an invalid email with 422 and a field error', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validRegisterBody, email: 'not-an-email' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
        );
    });

    it('rejects a short password with 422', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validRegisterBody, password: 'short', confirm_password: 'short' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
        );
    });

    it('rejects mismatched passwords with 422', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validRegisterBody, confirm_password: 'different123' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'confirm_password' })]),
        );
    });

    it('rejects an invalid phone number with 422', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validRegisterBody, phone_number: 'not-a-phone!' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'phone_number' })]),
        );
    });

    it('rejects self-service admin registration (user_type 1) with 422', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validRegisterBody, user_type: 1 });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'user_type' })]),
        );
    });

    it('rejects an empty body with 422', async () => {
        const res = await request(app).post('/api/auth/register').send({});
        expect(res.status).toBe(422);
    });
});

describe('POST /api/auth/login — validation', () => {
    it('rejects missing credentials with 422', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(422);
    });
});

describe('protected routes', () => {
    it('GET /api/users/me without a token responds 401', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.status).toBe(401);
    });

    it('GET /api/users/me with a garbage token responds 401', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(res.status).toBe(401);
    });
});

// Real signed JWTs (same secret the app verifies with), so these tests
// exercise authenticate + authorize without touching the database.
const adminToken = jwt.sign(
    { sub: 'test-admin-uuid', email: 'admin@test.com', user_type: 1 },
    config.JWT_SECRET,
    { expiresIn: '5m' },
);
const customerToken = jwt.sign(
    { sub: 'test-user-uuid', email: 'user@test.com', user_type: 3 },
    config.JWT_SECRET,
    { expiresIn: '5m' },
);

describe('user management — authorization', () => {
    // Listing (GET / and POST /list) is deliberately open to ANY
    // authenticated user — only a missing/invalid token is rejected.
    // Create/update/status below remain admin-only.
    it('rejects listing without a token (401)', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });

    it('rejects create for a non-admin (403)', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({});
        expect(res.status).toBe(403);
    });
});

describe('user management — validation', () => {
    it('rejects invalid pagination params with 422', async () => {
        const res = await request(app)
            .get('/api/users?page=0&limit=999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'page' }),
                expect.objectContaining({ field: 'limit' }),
            ]),
        );
    });

    it('rejects create with missing mandatory fields (422)', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ first_name: 'OnlyName' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'email' }),
                expect.objectContaining({ field: 'phone_number' }),
                expect.objectContaining({ field: 'user_type' }),
            ]),
        );
    });

    it('rejects a malformed uuid in the status route (422)', async () => {
        const res = await request(app)
            .patch('/api/users/not-a-uuid/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 0 });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'userUuid' })]),
        );
    });

    it('rejects an invalid status value (422)', async () => {
        const res = await request(app)
            .patch('/api/users/3b30be62-7e3d-400d-a444-97de867f1d2a/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 5 });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
        );
    });
});

describe('profile self-update — validation', () => {
    it('rejects without a token (401)', async () => {
        const res = await request(app).patch('/api/users/me').send({ first_name: 'X' });
        expect(res.status).toBe(401);
    });

    it('rejects an invalid phone number (422)', async () => {
        const res = await request(app)
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ phone_number: 'not-a-phone!' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'phone_number' })]),
        );
    });
});

describe('category management - authorization', () => {
    it('rejects listing without a token (401)', async () => {
        const res = await request(app).get('/api/categories');
        expect(res.status).toBe(401);
    });

    it('rejects listing for a non-admin (403)', async () => {
        const res = await request(app)
            .get('/api/categories')
            .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });
});

describe('category management - validation', () => {
    it('rejects invalid pagination params with 422', async () => {
        const res = await request(app)
            .get('/api/categories?page=0&limit=999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'page' }),
                expect.objectContaining({ field: 'limit' }),
            ]),
        );
    });

    it('rejects create with a missing category name (422)', async () => {
        const res = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ description: 'Missing the name' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'category_name' })]),
        );
    });

    it('rejects an invalid category id param (422)', async () => {
        const res = await request(app)
            .delete('/api/categories/not-a-number')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'categoryId' })]),
        );
    });
});

describe('product management - authorization', () => {
    it('rejects listing without a token (401)', async () => {
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(401);
    });

    it('rejects listing for a non-admin (403)', async () => {
        const res = await request(app)
            .get('/api/products')
            .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });
});

describe('product management - validation', () => {
    it('rejects invalid list filters with 422', async () => {
        const res = await request(app)
            .get('/api/products?page=0&limit=999&status=7&category_id=0')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'page' }),
                expect.objectContaining({ field: 'limit' }),
                expect.objectContaining({ field: 'status' }),
                expect.objectContaining({ field: 'category_id' }),
            ]),
        );
    });

    it('rejects create with missing mandatory fields (422)', async () => {
        const res = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ product_name: 'OnlyName' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'category_id' }),
                expect.objectContaining({ field: 'price' }),
            ]),
        );
    });

    it('rejects an invalid product key param (422)', async () => {
        const res = await request(app)
            .delete('/api/products/not-a-uuid')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'productKey' })]),
        );
    });

    it('rejects price values with more than 2 decimals (422)', async () => {
        const res = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                product_name: 'Desk',
                category_id: 1,
                price: 10.999,
            });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'price' })]),
        );
    });
});

describe('cart — authorization & validation', () => {
    it('rejects listing without a token (401)', async () => {
        const res = await request(app).get('/api/cart');
        expect(res.status).toBe(401);
    });

    it('rejects add-to-cart without a token (401)', async () => {
        const res = await request(app).post('/api/cart').send({ product_key: 'x' });
        expect(res.status).toBe(401);
    });

    it('rejects a malformed product_key (422)', async () => {
        const res = await request(app)
            .post('/api/cart')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ product_key: 'not-a-uuid' });

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'product_key' })]),
        );
    });

    it('rejects an empty body (422)', async () => {
        const res = await request(app)
            .post('/api/cart')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({});
        expect(res.status).toBe(422);
    });

    it('rejects remove-from-cart without a token (401)', async () => {
        const res = await request(app).delete(
            '/api/cart/3b30be62-7e3d-400d-a444-97de867f1d2a',
        );
        expect(res.status).toBe(401);
    });

    it('rejects remove-from-cart with a malformed product key (422)', async () => {
        const res = await request(app)
            .delete('/api/cart/not-a-uuid')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'productKey' })]),
        );
    });
});

describe('home aggregate — optional auth', () => {
    // No-token and valid-token paths hit the database (products/carts), so
    // they belong in the DB-backed suite. What IS testable here: a token
    // that is PRESENT must still verify — optional auth is not "ignore bad
    // tokens", otherwise the FE could never distinguish "guest" from
    // "session expired, refresh and retry".
    it('rejects a garbage token with 401 (present ⇒ must verify)', async () => {
        const res = await request(app)
            .get('/api/home')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(res.status).toBe(401);
    });

    it('flags an expired token with TOKEN_EXPIRED so the FE refresh flow works', async () => {
        const expiredToken = jwt.sign(
            { sub: 'test-user-uuid', user_type: 3 },
            config.JWT_SECRET,
            { expiresIn: '-1s' },
        );
        const res = await request(app)
            .get('/api/home')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_EXPIRED');
    });
});

describe('unknown routes', () => {
    it('responds 404 with a JSON error', async () => {
        const res = await request(app).get('/api/nope');
        expect(res.status).toBe(404);
        expect(res.body.status).toBe('error');
    });
});
