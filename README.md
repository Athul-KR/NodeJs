# Auth API — layered architecture study project

A login & registration API built the way scalable Express codebases are structured:

```
Request → route → validate → controller → service → repository → MySQL
```

Each layer has one job and one rule:

| Layer | Job | Rule |
|---|---|---|
| **route** (`*.routes.js`) | Map URL + method to a controller, attach middleware | No logic at all |
| **validation** (`*.validation.js`) | Reject bad input at the edge (zod schemas) | Runs *before* the controller |
| **controller** (`*.controller.js`) | Translate HTTP ↔ domain | No business logic, no SQL, no try/catch |
| **service** (`*.service.js`) | Business logic | Never sees `req`/`res` — plain data in, plain data out |
| **repository** (`*.repository.js`) | Data access | All queries live here; no business decisions |
| **model** (`*.model.js`) | Sequelize table mapping | Defines columns, scopes, associations — no queries, no logic |

Errors are thrown as `AppError` from anywhere and handled **once** in
`middlewares/errorHandler.js` — Express 5 forwards async throws automatically,
so there is no try/catch anywhere in the app.

## Structure

```
src/
├── app.js                  ← builds the Express app (no .listen — tests import this)
├── server.js               ← connects DB, starts the app, graceful shutdown
├── config/
│   ├── index.js            ← loads .env and VALIDATES it at boot (zod)
│   └── database.js         ← Sequelize instance (owns the mysql2 pool)
├── middlewares/
│   ├── errorHandler.js     ← 404 handler + the single global error handler
│   ├── validate.js         ← zod validation middleware factory
│   ├── authenticate.js     ← JWT guard, attaches req.user
│   └── rateLimiters.js     ← brute-force limiter for auth endpoints
├── shared/
│   ├── AppError.js         ← operational error with an HTTP status code
│   └── logger.js           ← pino structured logger
├── modules/                ← one folder per FEATURE, not per layer
│   ├── auth/               ← register, login, refresh (with rotation), logout
│   │                          + refreshToken.model.js (Sequelize model + association)
│   └── users/              ← user.model.js (defaultScope hides password) + GET /me
└── database/
    ├── cli-config.cjs      ← DB config for sequelize-cli (paths set in .sequelizerc)
    └── migrations/         ← sequelize-cli migrations (bookkept in SequelizeMeta)
tests/
└── app.test.js             ← Supertest integration tests (no port, no DB needed)
```

## ORM

Data access uses **Sequelize** (the most Eloquent-like Node ORM). Models
define the table mapping; `defaultScope` excludes the password hash from
every query unless the `withPassword` scope opts back in (Eloquent's
`$hidden`), and the `RefreshToken.belongsTo(User)` association replaces the
hand-written JOIN. Git history keeps the raw-SQL version — `git diff` the
first two commits to see exactly how little the service/controller layers
changed when the data layer was swapped.

## Setup

```bash
npm install
cp .env.example .env        # fill in DB credentials + generate JWT_SECRET

npm run db:create        # create the database itself (once) — migrations only manage what's INSIDE it
npm run migrate
npm run seed              # bootstrap admin: admin@example.com / Admin@12345 (change it!)

npm run dev                 # → http://localhost:3000
npm test                    # run the Supertest suite
```

## Endpoints

| Method | URL | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `first_name, last_name?, email, password, confirm_password, phone_number, user_type?` | 201 + user + token pair |
| POST | `/api/auth/login` | `email, password` | user + token pair |
| POST | `/api/auth/refresh` | `refreshToken` | **rotates**: old token dies, new pair issued |
| POST | `/api/auth/logout` | `refreshToken` | revokes the refresh token |
| GET | `/api/users/me` | — | requires `Authorization: Bearer <accessToken>` |
| PATCH | `/api/users/me` | any of `first_name, last_name, phone_number` (+ optional file `profile_image`) | self-service profile edit — email is immutable here; `user_type`/`status` are stripped |
| GET | `/health` | — | uptime check |

### User management (admin-only — 403 for other types)

| Method | URL | Body / params | Notes |
|---|---|---|---|
| GET | `/api/users` | `?page=&limit=&search=&status=&user_type=` | newest first; search matches name/email/phone; returns pagination `{ total_users, current_page, per_page, total_pages }` |
| POST | `/api/users` | multipart: `first_name, last_name?, email, phone_number, user_type` + optional file `profile_image` | 201 + user + one-time `temp_password` (stand-in for an invite email) |
| PATCH | `/api/users/:userUuid` | any subset of the create fields (+ optional new `profile_image`) | partial update |
| PATCH | `/api/users/:userUuid/status` | `{ "status": 0 \| 1 }` | deactivate (0) also revokes the user's refresh tokens; self-deactivation refused |

Profile images: JPEG/PNG/WebP, max 2MB, stored under `uploads/profile-images/`
(gitignored) with random names and served at `/uploads/…`. A deactivated user
gets `403 ACCOUNT_DEACTIVATED` on login and refresh; their live access token
keeps working for at most its 15-minute TTL (stateless JWT trade-off).

`user_type` is a TINYINT enum-by-convention (`users/user.constants.js`):
`1 = admin`, `2 = user` (default), `3 = customer`. Self-registration only
accepts 2 or 3 — admin accounts are created by a seeder or an existing admin,
never via the public endpoint. `confirm_password` is checked against
`password` at the validation layer and never stored. The user's type also
rides in the JWT claims, so future role checks need no DB lookup.

### Category management (admin-only)

| Method | URL | Body / params | Notes |
|---|---|---|---|
| GET | `/api/categories` | `?page=&limit=&search=` | newest first; search matches category name; returns pagination `{ total_categories, current_page, per_page, total_pages }` |
| POST | `/api/categories` | `{ category_name, description? }` | 201; name must be unique (409 otherwise) |
| PATCH | `/api/categories/:categoryId` | any subset of the create fields | partial update |
| DELETE | `/api/categories/:categoryId` | — | 409 while ANY product (soft-deleted included — the FK is RESTRICT) still references it |

Categories expose their numeric `id` on purpose: products are assigned and
filtered via `category_id`.

### Product management (admin-only)

| Method | URL | Body / params | Notes |
|---|---|---|---|
| GET | `/api/products` | `?page=&limit=&search=&status=&category_id=` | newest first; search matches product name; each row embeds its `category` (id, name, description) and `image` path; soft-deleted rows never appear |
| POST | `/api/products` | multipart: `product_name, description?, category_id, price, status?` + optional file `image` | 201; `category_id` must exist (400 otherwise) |
| PATCH | `/api/products/:productKey` | any subset of the create fields (+ optional new `image`) | partial update; replaced images are deleted from disk |
| DELETE | `/api/products/:productKey` | — | SOFT delete: sets `deleted_at`; the row vanishes from listing/edit but stays in the table |

### Cart (any logged-in user — always the caller's own cart)

| Method | URL | Body / params | Notes |
|---|---|---|---|
| GET | `/api/cart` | — | items in `order_by` order, each embedding its `product` (with category); products soft-deleted since being added are hidden |
| POST | `/api/cart` | `{ "product_key": "<uuid>" }` | 201; 404 unknown product, 400 inactive product, 409 already in cart |

The user is always taken from the JWT — `user_id` is never accepted from the
client. `order_by` is assigned `max+1` per user on insert; a composite unique
index on `(user_id, product_id)` backs the duplicate check.

Products are addressed by their public uuid `key` (the auto-increment `id`
never leaves the API). `status` is TINYINT: `0 = inactive`, `1 = active`
(filterable in the listing). `price` is `DECIMAL(10,2)` and is returned as a
string (e.g. `"499.99"`) — deliberate, to avoid float precision loss. Product
images follow the same rules as profile images (JPEG/PNG/WebP, 2MB, random
names) and land in `uploads/product-images/`. If a request fails after an
upload was stored (validation or any API error), the orphaned file is
automatically reaped.

## Token model

- **Access token** — JWT, 15 min. Sent as `Authorization: Bearer …` on every request. Stateless: verified by signature, no DB hit for validity.
- **Refresh token** — 64 random bytes, 7 days. Only its **SHA-256 hash** is stored (`refresh_tokens.token_hash`), so a leaked database contains no usable sessions. Traded at `/refresh` for a new pair; the presented token is **revoked, not deleted** (rotation).
- **Reuse detection** — a revoked token that is presented again means two parties hold copies (the client and a thief), so **all** of that user's sessions are revoked: `401 { code: "REFRESH_TOKEN_REUSED" }`.
- **Purge job** — `server.js` sweeps rows past expiry at boot and daily; revoked rows survive until expiry because they are the reuse tripwires.
- On `401 { code: "TOKEN_EXPIRED" }` the client silently calls `/refresh` and retries; on `401 { code: "REFRESH_TOKEN_INVALID" }` or `REFRESH_TOKEN_REUSED` the user must log in again.

## Postman

Import `postman/Auth-API.postman_collection.json` — 5 folders covering every
module. Run **Login as Admin** first; tokens and created ids
(`userUuid`, `categoryId`, `productKey`) are auto-saved into collection
variables, so the edit/delete requests chain without copy-pasting.

## Example session

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Athul","email":"athul@example.com","password":"secret123","confirm_password":"secret123","phone_number":"+91 98765 43210","user_type":3}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"athul@example.com","password":"secret123"}'

curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <accessToken from login>"
```
