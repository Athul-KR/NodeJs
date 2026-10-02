# Project Documentation — Auth & Catalog API

> **Audience:** developers and AI assistants maintaining or extending this codebase.
> Read this file top-to-bottom once; afterwards the **Module reference**, **Recipes**
> and **Deliberate decisions** sections answer most day-to-day questions.
> Keep this document updated when you change architecture, conventions, or endpoints.

---

## 1. What this is

A REST API for authentication, user management, and a product catalog, built as a
layered-architecture study project that follows production conventions throughout.

**Stack:** Node.js (ES modules), Express **5**, Sequelize 6 (MySQL/MariaDB via
`mysql2`), Zod (validation), JWT (`jsonwebtoken`), bcrypt, multer (uploads),
pino (logging), Vitest + Supertest (tests), sequelize-cli (migrations/seeders).

**Runtime facts that matter:**
- `package.json` has `"type": "module"` → every `.js` file is an ES module
  (`import`/`export`). Files loaded by sequelize-cli (config, migrations,
  seeders) must be CommonJS and therefore use the `.cjs` extension.
- Express **5**: async route handlers/middleware may simply `throw` — Express
  forwards rejections to the global error handler. There is deliberately **no
  try/catch anywhere** in controllers/services. Also `req.query` is a read-only
  getter in Express 5 (see §5.3).
- Local dev DB is XAMPP MySQL/MariaDB, database name `nodejs_auth`.

## 2. Setup & scripts

```bash
npm install
cp .env.example .env          # then fill values (see table below)
npm run db:create             # creates the database itself (once)
npm run migrate               # applies pending migrations
npm run seed                  # bootstrap admin: admin@example.com / Admin@12345
npm run dev                   # nodemon, http://localhost:3000
npm test                      # Vitest + Supertest (NO database needed)
```

| Script | What it does |
|---|---|
| `npm run dev` / `start` | run with nodemon / plain node |
| `npm run db:create` / `db:drop` | create/drop the database (sequelize-cli) |
| `npm run migrate` / `migrate:rollback` / `migrate:status` | apply / undo-latest / show migrations |
| `npm run seed` / `seed:rollback` | run / undo seeders |
| `npm test` | run the test suite |

**Environment variables** — validated at boot by `src/config/index.js` (Zod);
the process exits with a readable message if anything is missing/malformed:

| Var | Meaning | Notes |
|---|---|---|
| `NODE_ENV` | development / test / production | default `development` |
| `PORT` | HTTP port | default 3000 |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection | password may be empty (XAMPP) |
| `JWT_SECRET` | signs access tokens | **min 32 chars**, enforced |
| `ACCESS_TOKEN_TTL` | JWT lifetime | default `15m` |
| `REFRESH_TOKEN_DAYS` | refresh token lifetime | default 7 |

## 3. Architecture

Request lifecycle:

```
Request → route → [authenticate] → [authorize] → [upload] → validate → controller → service → repository → MySQL
                                                                            ↓ throws AppError anywhere
                                              notFoundHandler → errorHandler (single place errors become JSON)
```

One folder per **feature** (not per layer) under `src/modules/`. Each layer has
one job and one rule:

| Layer (file suffix) | Job | Hard rule |
|---|---|---|
| `*.routes.js` | map URL+method to controller, attach middleware chain | no logic at all |
| `*.validation.js` | Zod schemas, run by `validate()` **before** the controller | pure schemas, no I/O |
| `*.controller.js` | translate HTTP ↔ domain: read req, call ONE service fn, shape response | no business logic, no queries, no try/catch |
| `*.service.js` | ALL business logic | never sees `req`/`res`; plain data in/out; throws `AppError` |
| `*.repository.js` | ALL data access | every ORM query lives here; no business decisions; Op/includes stay here |
| `*.model.js` | Sequelize table mapping | columns, scopes, associations only — no queries |
| `*.constants.js` | named values for TINYINT enums etc. | the ONE place numbers get names |

**Dependency rules (import direction):**
- `auth` module imports from `users` (repository, `toPublicUser`, `hashPassword`,
  constants). The reverse — `users` importing `auth.service` — would create a
  circular import and is forbidden. `users` MAY import `auth.repository`
  (used for revoking refresh tokens on deactivation) — that path has no cycle.
- `products` imports from `categories` (model for the association, repository
  for existence checks). `categories` imports `product.repository` only for the
  delete guard.
- `carts` imports from `users` and `products` (repositories, constants,
  `toPublicProduct`); nothing imports from `carts`.
- Middlewares and `shared/` are imported by anyone; they import nothing from modules.

## 4. Directory map

```
src/
├── app.js                     builds the Express app (NO .listen — tests import this)
├── server.js                  connects DB, starts app, graceful shutdown, daily token-purge job
├── config/
│   ├── index.js               loads .env and validates it (exits on error)
│   └── database.js            the single Sequelize instance (owns the mysql2 pool)
├── shared/
│   ├── AppError.js            operational error w/ HTTP status + optional machine code
│   └── logger.js              pino (pretty in dev, JSON in prod, silent in test)
├── middlewares/
│   ├── errorHandler.js        404 handler + THE global error handler (registered last)
│   ├── validate.js            zod middleware factory (see §5.3 for where output lands)
│   ├── authenticate.js        JWT guard → req.user (stateless, NO DB hit)
│   ├── authorize.js           role guard using req.user.user_type (after authenticate)
│   ├── upload.js              multer factory: profile & product images + orphan reaping
│   └── rateLimiters.js        brute-force limiter for /register & /login
├── modules/
│   ├── auth/                  register, login, refresh (rotation+reuse detection), logout
│   ├── users/                 self profile (GET/PATCH /me) + admin user management
│   ├── categories/            category CRUD (admin)
│   ├── products/              product CRUD w/ image, soft delete (admin)
│   └── carts/                 add-to-cart + cart listing (any authed user, own cart only)
└── database/
    ├── cli-config.cjs         DB config for sequelize-cli (paths wired in .sequelizerc)
    ├── migrations/*.cjs       numbered, immutable once applied (see §6.2)
    └── seeders/*.cjs          001 = bootstrap admin
tests/app.test.js              Supertest integration tests (no port, no DB)
uploads/                       gitignored; profile-images/ and product-images/
```

## 5. Cross-cutting contracts

### 5.1 Response envelope

Every response follows one of these shapes:

```jsonc
// success
{ "status": "success", "data": { ... } }              // or "message" for delete-style ops
// operational error (thrown AppError)
{ "status": "error", "message": "...", "code": "MACHINE_CODE?" }
// validation failure (from validate(), always HTTP 422)
{ "status": "error", "message": "Validation failed",
  "errors": [ { "field": "email", "message": "Invalid email address" } ] }
```

Status codes in use: 200/201, 400 (bad request incl. bad upload / bad category_id /
self-deactivation), 401 (unauthenticated), 403 (authenticated but not allowed /
deactivated account), 404, 409 (duplicates, category-in-use), 422 (validation), 500.

Machine codes clients act on: `TOKEN_EXPIRED` (silently call /refresh and retry),
`REFRESH_TOKEN_INVALID` (re-login), `REFRESH_TOKEN_REUSED` (theft response —
all sessions were revoked), `ACCOUNT_DEACTIVATED`.

Pagination shape (all list endpoints):
`{ total_<things>, current_page, per_page, total_pages }` — `total_pages` is
never below 1.

### 5.2 AppError & the error handler

Throw `AppError.badRequest/unauthorized/forbidden/notFound/conflict(message, code?)`
from **anywhere**; `middlewares/errorHandler.js` turns it into the JSON above.
Anything that is not an AppError is logged in full and answered with a generic
500 (the real message leaks only in development). The error handler also reaps
any multer upload stored before the failure (see §5.5).

### 5.3 validate() middleware — where parsed data lands

`validate(schema, source = 'body' | 'query' | 'params')` runs the Zod schema and:
- **body** → the parsed result REPLACES `req.body` (unknown keys stripped,
  strings coerced). Controllers/services can trust it completely.
- **query / params** → result goes to `req.validated.query` / `req.validated.params`,
  because Express 5's `req.query` is a read-only getter. Controllers read the
  validated copy, never the raw input.

On failure it responds 422 itself (does not throw) and reaps any stored upload.

### 5.4 authenticate & authorize — the JWT contract

Access-token claims: `{ sub: user_uuid, email, user_type }`, TTL 15 min.
`authenticate` verifies the signature (NO DB hit — that is the point) and sets
`req.user = { user_uuid, email, user_type }`. `authorize(...types)` compares
`req.user.user_type` against the allowed list — also DB-free.
`401` = not authenticated; `403` = authenticated but not permitted.
Consequences to remember:
- A deleted/blocked/demoted user keeps access for at most one token TTL.
  Deactivation therefore also revokes all their refresh tokens.
- If you add a claim, old tokens won't have it until re-login.

### 5.5 File uploads

`middlewares/upload.js` exposes `uploadProfileImage` (field `profile_image`,
dir `uploads/profile-images/`) and `uploadProductImage` (field `image`, dir
`uploads/product-images/`) built by one factory. Rules: JPEG/PNG/WebP only
(mimetype check), 2 MB max (enforced while streaming), stored under
`crypto.randomUUID() + ext` — never the client filename. Multer errors are
translated to 400 AppErrors. Files are served statically at `/uploads/…`
(`app.js`). **Orphan reaping:** multer writes before validation runs, so
`validate()`'s 422 branch and the global error handler both call
`discardUploadedFile(req)`; a request that fails after upload leaves no file
behind. Replaced images (profile/product edits) are unlinked best-effort via
`deleteImageFile(publicPath)`.

### 5.6 Rate limiting & security headers

`authLimiter` (20 req / 15 min / IP) guards `/register` and `/login` only;
it is skipped under `NODE_ENV=test`. `helmet()` + `cors()` + JSON body limit
`10kb` (multipart is separate, handled by multer) are applied globally.

## 6. Database

### 6.1 Conventions

- **Dual identifiers:** every externally-visible row has an internal
  auto-increment `id` (BIGINT UNSIGNED, used for FKs, never leaves the API)
  and a public identifier (`user_uuid`, product `key` — CHAR(36) uuid).
  `toPublicUser`/`toPublicProduct` strip `id` and secrets. **Exception:**
  categories expose their numeric `id` on purpose — products are assigned and
  filtered by `category_id`.
- **Enums are TINYINT-by-convention**, named in `*.constants.js`:
  `USER_TYPES` 1=admin 2=user 3=customer; `USER_STATUS` / `PRODUCT_STATUS`
  0=inactive 1=active. No MySQL ENUM columns (painful to alter).
- **Timestamps** are owned by MySQL (`timestamps: false` in every model):
  `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `updated_at … ON UPDATE
  CURRENT_TIMESTAMP` — always with EXPLICIT defaults in migrations (see gotcha
  §10-G1). Nullable time columns (`revoked_at`, `deleted_at`) are DATETIME.
- **Soft delete** exists only where the table has `deleted_at` (products).
  Sequelize's `paranoid` mode is NOT used — filtering is explicit in the
  repository (`deleted_at: null` on every find/update).

### 6.2 Tables (as of migration 007)

- **users**: id, user_uuid (uniq), first_name, last_name, email (uniq),
  password (bcrypt hash, hidden by `defaultScope`; the `withPassword` scope
  opts back in for login only), phone_number, user_type, profile_image (nullable
  public path), status, created_at, updated_at.
- **refresh_tokens**: id, user_id (FK→users CASCADE), token_hash (CHAR(64)
  uniq — SHA-256 of the token; plaintext is never stored), expires_at (DATETIME),
  revoked_at (DATETIME nullable — soft-revoke, the reuse tripwire), created_at.
- **categories**: id, category_name (uniq), description, created_at, updated_at.
- **products**: id, key (uniq uuid), product_name, description, category_id
  (FK→categories, **RESTRICT**), image (nullable public path), price
  DECIMAL(10,2), status, created_at, updated_at, deleted_at (DATETIME nullable).
  Indexes on category_id, status, deleted_at.
- **carts**: id, user_id (FK→users CASCADE), product_id (FK→products CASCADE),
  order_by (INT — per-user position, assigned max+1 on insert), status,
  created_at, updated_at. UNIQUE (user_id, product_id) — the hard duplicate
  guard; index (user_id, order_by). No quantity column (spec-faithful).

### 6.3 Migrations & seeders — rules

1. Migrations and models are a PAIR: a column changed by a migration must be
   mirrored in the model's `init()` (Sequelize never inspects the live schema;
   an undeclared column is invisible on reads and **silently dropped** on writes).
2. Never edit a migration that has run anywhere shared — write a new one
   ("roll forward"). Editing is acceptable only for an uncommitted migration in
   local dev (rollback → edit → re-migrate).
3. Every migration needs a real `down()`. `npm run migrate:rollback` undoes the
   most recent; `db:migrate:undo:all --to <name>` undoes down to AND INCLUDING
   the named one.
4. `db:migrate` cannot create the database — `npm run db:create` does.
5. Seeders are idempotent (001 checks for the admin email before inserting).

## 7. Auth model (read before touching anything in src/modules/auth)

- **Register** (`POST /api/auth/register`): public; only user_type 2/3 —
  never admin. `confirm_password` is validation-only (never stored). Duplicate
  email → 409. Issues a token pair immediately.
- **Login**: same 401 message for unknown email and wrong password (no account
  probing). Deactivated account → 403 `ACCOUNT_DEACTIVATED`, checked AFTER
  password verification.
- **Token pair**: access JWT (15 min, stateless) + refresh token (64 random
  bytes hex; DB stores only its SHA-256; 7 days).
- **Refresh** (`POST /api/auth/refresh`): rotation — the presented token is
  soft-revoked (`revoked_at`) and a new pair issued. If a REVOKED token is
  presented again ⇒ reuse ⇒ two parties hold copies ⇒ **all sessions for the
  user are deleted** and the response is 401 `REFRESH_TOKEN_REUSED`.
  Plain SHA-256 (not bcrypt) is correct for these tokens: input is 512 bits of
  randomness, nothing to brute-force.
- **Logout**: soft-revokes the presented token (keeps the row as a tripwire).
- **Purge job** (`server.js`): deletes rows past `expires_at` at boot + daily.
  Revoked-but-unexpired rows MUST survive (they are the tripwires).
- **Password hashing** lives in `user.service.js` (`hashPassword`, bcrypt cost
  10, 72-byte input cap reflected in validation max).

## 8. Module reference (endpoints)

Auth required unless marked public. "admin" = `authorize(USER_TYPES.ADMIN)`.

### auth (`/api/auth`) — public, rate-limited where noted
| Method+path | Body | Behavior |
|---|---|---|
| POST /register (limited) | first_name, last_name?, email, password, confirm_password, phone_number, user_type? (2/3) | 201, user + token pair |
| POST /login (limited) | email, password | user + token pair; 403 if deactivated |
| POST /refresh | refreshToken | rotates; reuse ⇒ nuke + 401 REFRESH_TOKEN_REUSED |
| POST /logout | refreshToken | revokes it |

### users (`/api/users`)
| Method+path | Who | Notes |
|---|---|---|
| GET /me | any authed | own profile |
| PATCH /me | any authed | self edit: first_name, last_name, phone_number + optional `profile_image` file. **email immutable; user_type/status stripped by schema AND whitelisted again in the service (defense in depth)** |
| GET / | admin | list: `?page&limit&search&status&user_type`; search hits name/email/phone |
| POST / | admin | multipart create; no password field — random `temp_password` returned ONCE (invite-email stand-in) |
| PATCH /:userUuid | admin | partial update incl. email/user_type + optional image |
| PATCH /:userUuid/status | admin | 0/1; deactivate also revokes refresh tokens; self-deactivation → 400 |

Route-order caveat: `/me` routes are registered BEFORE `/:userUuid`.

### categories (`/api/categories`) — all admin
CRUD + list with `?page&limit&search` (search = category_name LIKE).
Unique name (409). DELETE → 409 while ANY product references it — including
soft-deleted products, matching the RESTRICT FK (deliberate; see §10-D3).

### products (`/api/products`) — all admin
| Method+path | Notes |
|---|---|
| GET / | `?page&limit&search&status&category_id`; rows embed `category` {id, category_name, description} and `image`; soft-deleted never appear |
| POST / | multipart: product_name, description?, category_id (must exist → else 400), price, status?; optional file `image` |
| PATCH /:productKey | partial; new image replaces + deletes old file; soft-deleted rows 404 |
| DELETE /:productKey | SOFT delete (sets deleted_at) |

Price: validated to ≥0, ≤99999999.99, max 2 decimals; returned as a STRING
(e.g. "499.99") — deliberate DECIMAL handling, no float loss.

### carts (`/api/cart`) — any authenticated user, ALWAYS the caller's own cart
| Method+path | Notes |
|---|---|
| GET / | items in order_by order; each embeds its `product` (public shape incl. category); rows whose product was soft-deleted are hidden (inner join on deleted_at IS NULL) |
| POST / | `{ product_key }`; validates the JWT user still exists & is active, the product exists (404) and is active (400); duplicate → 409 (backed by the unique index) |

`user_id` is never read from the request body. Cart rows expose no internal
ids — the embedded product's `key` is the address a future remove/reorder API
should use. `toPublicProduct` is exported from `product.service.js` for reuse
here (Vitest tolerates a missing named export; native Node ESM crashes — keep
shared shapers exported).

## 9. Testing

`tests/app.test.js` imports the real `app` (no `.listen`) into Supertest.
The suite is deliberately **DB-free**: it covers validation (422 shapes),
authentication (401), authorization (403 — real JWTs signed with the test env's
`JWT_SECRET`), and 404s. The rate limiter is disabled under `NODE_ENV=test`;
the logger is silent. Anything touching MySQL is verified manually/e2e against
the dev DB (a dedicated test-DB suite is a known TODO). Pattern for new tests:
build one fully-valid body constant, then break exactly one field per test and
assert `errors` contains that field.

## 10. Deliberate decisions & gotchas (do NOT "fix" these without reading)

- **G1 — MySQL TIMESTAMP trap:** the FIRST TIMESTAMP column in a table without
  an explicit default silently gets `DEFAULT CURRENT_TIMESTAMP ON UPDATE
  CURRENT_TIMESTAMP`. Migration 003 had to repair `refresh_tokens.expires_at`
  because of this. Always give TIMESTAMP columns explicit defaults; use
  DATETIME for nullable time fields.
- **D1 — Stateless authenticate:** no DB lookup per request. Trade-off: revoked
  users keep access ≤15 min. Compensations: deactivation revokes refresh
  tokens; `user_type` rides in the JWT so authorize is also DB-free.
- **D2 — Refresh reuse ⇒ nuke:** a legitimate client retrying an old token
  (flaky network) will log the user out everywhere. Known sharp edge; a grace
  window is a possible future refinement.
- **D3 — Category delete guard counts soft-deleted products** — must agree with
  the RESTRICT FK, which knows nothing about `deleted_at`. Don't add a
  `deleted_at: null` filter to `countByCategoryId`.
- **D4 — price is a string in responses** (mysql2 DECIMAL behavior, kept on
  purpose). Clients must not compare it numerically without parsing.
- **D5 — Everything except auth + /me is admin-only** for now, including
  product/category listing. A public storefront listing is a one-line
  `authorize` change per route when needed.
- **D6 — Unknown body fields are silently stripped** by Zod (`email` sent to
  PATCH /me is ignored, not an error). This is the chosen API style.
- **D7 — Admin bootstrap:** registration refuses user_type 1; the seeder is the
  only door (dev credentials `admin@example.com / Admin@12345` — must be
  changed in any real deployment).
- **D8 — bcrypt password cap:** validation max 72 chars = bcrypt input limit.
- **D9 — LIKE search escaping:** repositories escape `% _ \` before building
  LIKE patterns. Keep doing that for new search fields.
- **G2 — Sequelize models are explicit:** unlike Laravel's Eloquent, a column
  missing from `Model.init()` silently doesn't exist to the app (see §6.3-1).
- **G3 — `.cjs` files:** anything sequelize-cli loads (cli-config, migrations,
  seeders, `.sequelizerc`) is CommonJS by extension because the CLI uses
  `require()` and the package is `"type": "module"`.

## 11. Recipes

**Add a column to an existing table**
1. New numbered migration (`src/database/migrations/NNN-*.cjs`) with real up+down.
2. Mirror the column in the module's `*.model.js`.
3. If user-supplied: add to the Zod schema(s), thread through
   controller → service → repository `create`/update whitelists.
4. If sensitive: exclude via scope or the module's `toPublicX`.
5. `npm run migrate`, extend tests, update README + this file.

**Add a new module (e.g. orders)**
1. `src/modules/orders/` with routes/validation/controller/service/repository/
   model (+constants for any TINYINT enum). Copy the products module as the
   closest template (it has uploads, soft delete, FK checks, listing).
2. Migration for the table (dual identifiers: internal id + public uuid `key`).
3. Mount in `app.js`: `app.use('/api/orders', orderRoutes)`.
4. Middleware order in routes: `authenticate → authorize → upload → validate(params) → validate(body) → controller`.
5. Tests: 401, 403, one 422 per schema, param-format 422.

**Add a role-gated endpoint for non-admins**
Use `authorize(USER_TYPES.USER, USER_TYPES.CUSTOMER)` — authorize is variadic.
Remember old JWTs lack newly-added claims.

## 12. Known limitations / natural next steps

- No password change/reset flow (would revoke all refresh tokens via
  `authRepository.deleteAllForUser`).
- Email uniqueness is check-then-insert (a race can slip through to the DB's
  unique index → raw 500 instead of 409; wrap in a catch if it matters).
- Image mimetype is trusted from the multipart header; production hardening
  would sniff magic bytes (`file-type` package).
- Uploads live on local disk — move to object storage (S3 etc.) for multi-node.
- Tests that need MySQL (happy-path register/login, catalog CRUD) belong in a
  dedicated test-database suite.
- No CI, linting config, or Docker setup yet.
