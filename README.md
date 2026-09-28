# 🛒 E-Commerce Backend API

A production-grade, scalable e-commerce REST API built with Node.js, Express, PostgreSQL, MongoDB, and Redis. Designed with clean architecture, security best practices, and real-world engineering decisions at its core.

> **Open Source for Frontend Developers** — This is a backend-only project. Frontend developers can build full-featured e-commerce applications on top of this API without worrying about backend complexity.

---

## 📌 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture & Design Decisions](#-architecture--design-decisions)
- [Project Structure](#-project-structure)
- [API Overview](#-api-overview)
- [Authentication Flow](#-authentication-flow)
- [API Reference](#-api-reference)
  - [Auth Module](#auth-module)
  - [Cart Module](#cart-module)
  - [Address Module](#address-module)
  - [Product Module](#product-module)
  - [Category Module](#category-module)
  - [Orders Module](#orders-module)
  - [Payments Module](#payments-module)
- [Function & Middleware Reference](#-function--middleware-reference)
- [Rate Limiting](#-rate-limiting)
- [Response Caching](#-response-caching)
- [Database Schema](#-database-schema)
- [Pagination & Filtering](#-pagination--filtering)
- [Error Handling](#-error-handling)
- [Setup Instructions](#️-setup-instructions)
- [API Testing](#-api-testing)
- [What I Learned](#-what-i-learned)
- [Contributing](#-contributing)

---

## 📌 Project Overview

### What it does
A complete backend system for an e-commerce platform — handling user authentication, product catalog with category hierarchy, image uploads, shopping cart, orders, payments, and background jobs.

### Who it's for
- **Frontend developers** who want a production-ready API to build React, Next.js, Vue, or mobile apps on top of
- **Recruiters and interviewers** evaluating backend engineering skills
- **Students and developers** studying industry-grade backend architecture

### Why it exists
Most e-commerce tutorials either oversimplify the backend or rely on third-party platforms. This project demonstrates how a real backend is architected — with deliberate decisions around databases, security, scalability, and maintainability.

---

## ✨ Key Features

### Authentication & Security
- JWT-based authentication with **access + refresh token** strategy
- Refresh tokens stored **hashed** (SHA-256) in PostgreSQL
- Refresh tokens delivered via **HTTP-only cookies** (XSS protection)
- Token **rotation** on every refresh (replay attack prevention)
- Access-token **blacklist in Redis** on logout — stolen Bearer tokens die immediately, not after 15 minutes
- **Email verification** via 6-digit OTP (Nodemailer + Gmail), hashed in Redis with a 10-minute TTL
- OTP sent automatically on register; `POST /auth/send-otp` is the resend path
- Emails stored and looked up **lowercase** — `Sahil@Gmail.com` and `sahil@gmail.com` are the same account
- **bcrypt** password hashing with configurable salt rounds
- Role-based access control (`CUSTOMER` | `ADMIN`)
- **Per-route rate limiting** (Redis-backed) — IP + email counters on auth, IP on public GETs, userId on cart

### Shopping Cart
- Cart stored in Redis as a **hash** (`cart:<userId>`), not in PostgreSQL or MongoDB
- `HINCRBY` for atomic “add N more” — two tabs cannot overwrite each other
- 7-day TTL, refreshed on **writes only** (add / remove), not on GET
- GET joins Redis quantities with MongoDB for live name/price — cart never stores price as source of truth
- One Mongo `$in` query for the whole cart (no N+1 `findById` loop)
- Empty cart is `200` with `items: []`, not 404 — a missing basket is a normal state

### Orders & Payments
- Saved **addresses** in PostgreSQL — one default per user (partial unique index + `P2002` / `FOR UPDATE`-style app handling)
- **Checkout** copies Redis cart → Order + OrderItems + Payment (`PENDING`), snapshots name/price/address
- Mongo stock decremented with `quantity: { $gte: qty }` + `$inc`; rollback if Prisma/Razorpay fails
- **Razorpay** order created at checkout (`amount` in paise, `Math.round`); webhook HMAC on **raw body**; Checkout `order_id|payment_id` HMAC on `/payments/verify`
- Shared **`capturePayment`** — idempotent `PENDING` → `PAID` / `CAPTURED`
- **Cancel PENDING** restores stock; **cancel PAID** starts refund, stock returns on `refund.processed`

### Product Catalog
- **Flexible product attributes** — key-value pair system handles any product type (phones have RAM/storage, clothing has size/color)
- **Hierarchical category system** — self-referencing categories with parent-child relationships
- **Materialized path pattern** — `categoryPath` array enables filtering by parent category without recursive queries at read time
- **Dynamic filter endpoint** — aggregation pipeline extracts unique attribute values per category for frontend filter UI
- **Cloudinary image upload** — products and categories with CDN-delivered images
- **Slug auto-generation** — URL-friendly identifiers from product/category names, applied consistently via a shared utility
- **Soft delete** — categories blocked from deletion if active products exist; products hidden via `isActive` flag
- **Faker.js seed script** — generates realistic demo data across all categories with one command
- **GET list caching** — `GET /products` and `GET /categories` cached in Redis for 10 minutes; query string is part of the key so `?page=1` and `?page=2` never share a slot
- **Cache invalidation on write** — product/category create, update, delete, and image upload delete matching `cache:` keys via `SCAN` (not `KEYS`)
- **Cache stampede lock** — on a miss, only one request hits Mongo; others wait on a Redis `SET NX` lock then read the new cache

### Architecture
- Clean **Route → Controller → Service** separation
- Global error handling with `AppError` class (operational vs programmer errors)
- `asyncHandler` wrapper — zero try/catch repetition across controllers
- **Zod** schema validation as reusable middleware
- Environment-aware error responses (full stack trace in dev, safe messages in prod)

### Data Layer
- **Polyglot persistence** — PostgreSQL for relational data, MongoDB for flexible documents, Redis for cart / OTP / blacklist / rate limits / GET response cache
- **Prisma ORM** with full migration history
- **Mongoose** for MongoDB schema enforcement
- **Compound indexes** on frequently queried field combinations
- Database-level constraints (UNIQUE, FOREIGN KEY, NOT NULL)

### Developer Experience
- `.env.example` with all required variables
- Faker.js seed script for realistic demo data
- Consistent response envelope across every endpoint

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js + Express.js | HTTP server and routing |
| Primary DB | PostgreSQL + Prisma ORM | Users, refresh tokens, addresses, orders, payments |
| Document DB | MongoDB + Mongoose | Product catalog, categories (flexible schema) |
| Cache / Cart / OTP | Redis (`redis` + `rate-limit-redis`) | Cart, OTP, blacklist, rate limits, GET response cache, stampede locks |
| Authentication | JWT + bcrypt | Stateless auth with secure password storage |
| Email | Nodemailer + Gmail App Password | OTP delivery |
| Validation | Zod | Runtime schema validation |
| Rate Limiting | express-rate-limit | Per-route limits with Redis store |
| File Upload | Multer + Cloudinary | Image handling and CDN delivery |
| Fake Data | @faker-js/faker | Realistic seed data generation |
| Payments | Razorpay | Orders, Checkout verify, webhooks, refunds |

---

## 🏗 Architecture & Design Decisions

### Project Structure Philosophy
The project follows a **layered MVC architecture** where each layer has a single, well-defined responsibility:

```
Route       → URL definition only. No logic.
Controller  → HTTP coordination only. Calls service, returns response.
Service     → All business logic. No knowledge of HTTP.
Model       → Data schema and DB interaction.
Middleware  → Cross-cutting concerns (auth, validation, role checks, rate limits, response cache).
```

This separation means business logic is fully reusable — callable from REST routes, background jobs, CLI scripts, or tests without any HTTP dependency.

### Key Engineering Decisions

**Why JWT over Sessions?**
Sessions require server-side state and a shared session store across instances — a scalability problem. JWTs are stateless and verifiable by any server instance using the shared secret.

**Why Access Token + Refresh Token?**
A single long-lived token can't be revoked if stolen. Short-lived access tokens (15 min) limit the damage window. Refresh tokens (7 days) are stored in the database, making them revocable — logout actually works.

**Why store Refresh Tokens hashed?**
If the database is compromised, plain-text refresh tokens give attackers 7-day session access for every user. SHA-256 hashed tokens are useless without the originals.

**Why HTTP-only cookies for Refresh Tokens?**
`localStorage` is readable by any JavaScript on the page — XSS attacks can steal tokens. HTTP-only cookies are invisible to JavaScript; only the browser sends them.

**Why PostgreSQL for users, MongoDB for products?**
Users and refresh tokens have strict relational structure and benefit from ACID transactions. Products have variable attributes (a phone has RAM, a shirt has size) — MongoDB's flexible document model handles this naturally without sparse columns or complex joins.

**Why key-value pairs for product attributes instead of a mixed object?**
A free-form `Mixed` type in Mongoose can't be indexed, can't be queried by a specific attribute, and gives no structure for building a frontend filter UI. A key-value array `[{ key: "ram", value: "8GB" }]` is indexable, queryable with `$elemMatch`, and enables dynamic filter generation via aggregation.

**Why materialized path for category hierarchy?**
Filtering products by a parent category (e.g. "Electronics") requires knowing every descendant category ID ("Phones", "Laptops", ...). Recursive lookups at read time are slow. Instead, each product stores its full ancestor chain (`categoryPath`) at write time, so filtering by any ancestor is a single indexed `$in` query — no recursion needed on every request.

**Why soft delete instead of hard delete?**
Hard deleting a category that has historical products would break referential integrity and orphan data. Soft delete (`isActive: false`) preserves history while hiding records from public responses. Category deletion additionally checks for active products first and blocks deletion rather than cascading — preventing accidental mass data loss.

**Why explicit slug generation instead of a Mongoose pre-save hook?**
Mongoose's `pre('save')` hook only fires on `.save()`, not on `findByIdAndUpdate()` — which this project uses for all updates. Relying on the hook silently fails to regenerate slugs on update. Calling a shared `slugify()` utility explicitly in both `createProduct`/`createCategory` and `updateProduct`/`updateCategory` removes this hidden inconsistency.

**Why Redis for the cart, not Mongo/Postgres?**
A cart is a shopping basket: written often, allowed to vanish, and not money. Redis hashes give O(1) add/remove of a single product without rewriting the whole document, plus TTL so abandoned carts disappear without a cron job. Orders live in PostgreSQL because money cannot vanish.

**Why a Redis hash, not one JSON string?**
A JSON blob is a read-modify-write on every change — two tabs can overwrite each other. `HINCRBY` is atomic: field missing → create at N; field exists → add N.

**Why the cart does not store price?**
Price is not allowed to go stale. If Redis stored `price: 999` and an admin later set `899`, checkout would charge the wrong amount. Redis holds **productId + quantity** (intent). GET re-reads Mongo for name and price (the shelf tag). Stock is checked at order time, not on add.

**Why SHA-256 for OTP and access-token blacklist, bcrypt for passwords?**
Passwords are human-chosen and live for years — bcrypt is slow on purpose. OTPs are 6 random digits with a 10-minute TTL; access tokens die in 15 minutes. SHA-256 is instant and matches how refresh tokens are stored. The real OTP defenses are TTL, delete-after-use, and rate limiting — a 6-digit space is brute-forceable offline either way.

**Why two rate-limit counters (IP and email), not one key `ip+email`?**
A single glued key `1.2.3.4:alice@x.com` treats `1.2.3.4:bob@x.com` as a fresh bucket — one IP can attack unlimited emails. Two counters mean both must pass: this computer cannot hammer, and this inbox cannot be hammered.

**Why empty cart is 200, not 404?**
`GET /cart` asks “what’s in my basket?” An empty answer is success. 404 would mean the resource does not exist; 400 would mean the client sent a bad request. A new user or a cleared cart is neither.

**Why GET does not refresh cart TTL?**
TTL means “7 days since they last **changed** the basket.” Opening the cart page, a leftover tab, or a polling frontend is not shopping. If GET reset the timer, abandoned carts would live forever.

**Why lowercase email in the service, not in Zod?**
Zod is the HTTP door — it only runs on that route. `register` and `sendOtp` can also be called from each other (or later from a job) with no Zod. The service owns how email is stored. Zod only `.trim()`s and checks format.

**Why connect Redis before requiring `app`?**
`express-rate-limit` + `rate-limit-redis` talk to Redis when the limiter module loads. If `app.js` is required first, Redis is still closed and store init throws `ClientClosedError`. `server.js` runs `connectRedis()` then `require('./src/app')`.

**Why cache in middleware, not in `getProducts`?**
`cacheMiddleware(ttl)` is the same shape as `validate(schema)`: one function, TTL as the argument, the service never hears about Redis. The list JSON is already what the client needs. Wrapping `res.json` stores that exact envelope without a second mapper.

**Why the cache key includes `req.originalUrl`?**
`GET /products` and `GET /products?page=2` are different lists. One key `cache:products` would let page 2 overwrite page 1. `cache:${originalUrl}` makes each query string its own entry. Prefix `cache:` so it never collides with `cart:`, `otp:`, `bl:`, `rl:`, or `lock:`.

**Why fail-open if Redis is down?**
Cache is a speedup, not the source of truth. A `GET` error or a failed `setEx` must still return Mongo. A shop that 500s because Redis restarted is worse than a shop that is merely slower.

**Why only cache `success: true`?**
After `res.json` is wrapped, the error handler also calls `res.json`. Without the `data.success` check, a 400 would be stored for 10 minutes and every next visitor would get a cached error.

**Why `SCAN` instead of `KEYS` for invalidation?**
`KEYS cache:/products*` blocks Redis and walks the whole keyspace — cart, OTP, and rate limits wait too. `SCAN` walks in chunks (`COUNT: 100`). The cursor from Redis is a **string** (`"0"`), not the number `0`; comparing to `0` never ends the loop.

**Why invalidate from the service after Mongo succeeds?**
If create throws, there is nothing new to expose — don't drop a warm cache. If you invalidate before the write, a GET in between refills Redis with the **old** document. Category writes also drop `cache:/products*` because the product list populates category `name` / `slug`.

**Why a Redis lock on cache miss (stampede)?**
Invalidating (or a cold cache) plus 10 000 concurrent `GET /products` is 10 000 Mongo queries and 10 000 `SET`s — a cache stampede / thundering herd. `SET lock:<url> NX EX 10` lets **one** request rebuild the cache. Others poll Redis briefly, then read the new value.

**Why release the lock inside `res.json`, not after `next()`?**
Express `next()` does not wait for the controller. `await next()` then `releaseLock` in `finally` drops the lock **before** Mongo finishes, and the waiters all miss again. The lock is released in `res.json`'s `finally` — after `setEx` (or after a failed write / error body). If `res.json` never runs, `EX 10` still frees the lock.

**Why not cache-key versioning?**
Versioning puts `v5` in the key and invalidates by bumping `v` — old keys expire via TTL, no `SCAN`. Not implemented here: extra leftover keys until TTL, and `SCAN` + prefix delete is enough at this scale. Documented as a known next step, not as shipping code.

**Why copy address and price onto the Order?**
If OrderItem only stored `productId`, a later catalog price change would rewrite history. Checkout reads live Mongo **once**, then writes name, price, qty, lineTotal. Address fields are copied the same way so editing a saved address does not mutate old bills.

**Why Mongo `productId` is a string on OrderItem, not a Postgres FK?**
Products live in Mongo. Postgres cannot reference that `_id` as a foreign key. The line stores the id as text plus the snapshot.

**Why decrement stock with `$gte` + `$inc`, not read-then-write?**
Two checkouts can both read `quantity: 1` and both sell. `findOneAndUpdate({ quantity: { $gte: qty } }, { $inc: { quantity: -qty } })` is one atomic check. `null` → not enough stock. Lines already decremented are rolled back (`restoreStock`) if a later line fails or Prisma/Razorpay throws.

**Why clear the cart after the order row exists?**
Clear first + create fails = basket gone and no bill. Redis is not in the Prisma transaction. Order + items + payment first, then `DEL cart:<userId>`.

**Why Razorpay order inside checkout, not a second “pay” endpoint?**
One round trip: local order + Razorpay `order_id` for Checkout. The browser never sends an amount to charge — only that id.

**Why webhook HMAC on `req.rawBody`, not `JSON.stringify(req.body)`?**
Razorpay signs the exact bytes. Re-serializing JSON can change key order/spacing and fail the signature. `express.json({ verify })` stores the buffer as `req.rawBody`.

**Why both `/payments/verify` and `/payments/webhook`?**
Verify = Checkout `handler` (user still on the page). Webhook = Razorpay’s server, even if they close the tab. Both call `capturePayment`. If status is not `PENDING`, return — idempotent.

**Why cancel PENDING restores stock immediately, but PAID waits for `refund.processed`?**
PENDING never took money. PAID did — putting stock back before Razorpay confirms the refund would oversell if the refund fails.

**Why `updateMany` where `status: PENDING` (or `REFUND_INITIATED`) before restore?**
Two cancel/webhook deliveries can both pass an `if (status === …)` check. `updateMany` + `count === 0` claims the row once. `finishRefund` no-ops if the order is already `CANCELLED` (crash recovery if payment is `REFUNDED` but the order never flipped).

**Why a partial unique index on default address?**
Two first-address requests can both see “no default” and both insert `isDefault: true`. App logic is not enough. Postgres: `UNIQUE ("userId") WHERE "isDefault" = true`. A second `true` is `P2002`. Many `false` rows are allowed. Prisma 6 cannot express that `where` in schema — the index lives in a raw SQL migration.

---

## 📁 Project Structure

```
ecommerce-backend/
│
├── prisma/
│   ├── schema.prisma              # User, RefreshToken, Address, Order, OrderItem, Payment
│   └── migrations/                # Full migration history
│
├── src/
│   ├── config/
│   │   ├── prisma.js              # Prisma singleton — one connection pool
│   │   ├── mongoose.js            # MongoDB connection
│   │   ├── redis.js               # Redis client + connectRedis()
│   │   ├── mailer.js              # Nodemailer Gmail transporter
│   │   ├── razorpay.js            # Razorpay SDK instance
│   │   └── cloudinary.js          # Cloudinary SDK configuration
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── cart.controller.js
│   │   ├── address.controller.js
│   │   ├── order.controller.js
│   │   ├── payment.controller.js
│   │   ├── product.controller.js
│   │   └── category.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── cart.service.js
│   │   ├── address.service.js
│   │   ├── order.service.js
│   │   ├── payment.service.js
│   │   ├── product.service.js
│   │   └── category.service.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── cart.routes.js
│   │   ├── address.routes.js
│   │   ├── order.routes.js
│   │   ├── payment.routes.js
│   │   ├── product.routes.js
│   │   └── category.routes.js
│   │
│   ├── models/
│   │   ├── product.model.js       # Product with key-value attributes
│   │   └── category.model.js      # Self-referencing category tree
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js     # JWT verify + Redis blacklist check
│   │   ├── authorize.js           # Role-based access control
│   │   ├── rateLimit.js           # Per-route Redis rate limiters
│   │   ├── cache.js               # GET response cache + stampede lock
│   │   ├── upload.js              # Multer — memory storage for Cloudinary
│   │   ├── validate.js            # Zod schema validation factory
│   │   └── errorHandler.js        # Global error handler (dev vs prod modes)
│   │
│   ├── validators/
│   │   ├── auth.validator.js      # Zod schemas for auth routes
│   │   ├── cart.validator.js      # Zod schema for add-to-cart
│   │   ├── address.validator.js
│   │   ├── order.validator.js     # checkout addressId uuid
│   │   └── product.validator.js   # Zod schemas for product routes
│   │
│   ├── utils/
│   │   ├── AppError.js            # Custom error class with status codes
│   │   ├── asyncHandler.js        # Eliminates try/catch in every controller
│   │   ├── tokenUtils.js          # JWT generation helpers
│   │   ├── slugify.js             # URL-friendly slug generation
│   │   ├── cache.js               # SCAN invalidation + SET NX lock helpers
│   │   └── stock.js               # restoreStock (checkout rollback, cancel, refund)
│   │
│   ├── scripts/
│   │   └── seedProducts.js        # Faker.js seed — realistic demo products
│   │
│   └── app.js                     # Express config — middlewares and routes
│
├── server.js                      # Entry point — starts HTTP server only
├── .env.example                   # All required environment variables
└── README.md
```

---

## 🌐 API Overview

### Base URL
```
http://localhost:3000
```

### Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": { }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

### Authentication
Protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication Flow

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   Client    │         │  API Server  │         │  Database  │
└──────┬──────┘         └──────┬───────┘         └─────┬──────┘
       │                       │                       │
       │  POST /auth/register  │                       │
       │──────────────────────>│                       │
       │                       │  Hash password        │
       │                       │  Store user           │
       │                       │──────────────────────>│
       │                       │  SET otp:<email>      │  Redis, 10 min
       │                       │  Email 6-digit OTP    │
       │  201 { user }         │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  POST /auth/verify-otp│                       │
       │──────────────────────>│                       │
       │                       │  Compare SHA-256 hash │
       │                       │  isVerified = true    │
       │                       │  DEL otp:<email>      │
       │  200 { user }         │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  POST /auth/login     │                       │
       │──────────────────────>│                       │
       │                       │  Verify password      │
       │                       │  Generate tokens      │
       │                       │  Store hashed RT      │
       │                       │──────────────────────>│
       │  accessToken (body)   │                       │
       │  refreshToken (cookie)│                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  GET /auth/me         │                       │
       │  Authorization: Bearer <accessToken>          │
       │──────────────────────>│                       │
       │                       │  Verify JWT            │
       │                       │  Fetch fresh user      │
       │                       │──────────────────────>│
       │  200 { user }         │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  [Access token expires after 15 minutes]      │
       │                       │                       │
       │  POST /auth/refresh-token (cookie sent auto)  │
       │──────────────────────>│                       │
       │                       │  Hash cookie token     │
       │                       │  Find in DB             │
       │                       │  Delete old token       │
       │                       │  Create new token       │
       │                       │──────────────────────>│
       │  New accessToken      │                       │
       │  New refreshToken cookie                      │
       │<──────────────────────│                       │
       │                       │                       │
       │  POST /auth/logout    │                       │
       │  Authorization: Bearer <accessToken>          │
       │──────────────────────>│                       │
       │                       │  Delete refresh token │
       │                       │  SET bl:<sha256> TTL=exp-now
       │  200 { success }      │                       │
       │<──────────────────────│                       │
       │  Same access token now fails protect (401 Token revoked)
```

---

## 📖 API Reference

> **Format note:** Each endpoint lists its middleware chain in execution order, the exact internal flow inside the service layer, and every error case the route can return. This mirrors how the codebase actually executes a request, not just the happy path.

### Auth Module

#### POST `/auth/register`

**Purpose:** Create a new, unverified user account.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No |
| **Middleware Chain** | `validate(registerSchema)` → `register` |

**Request Body:**
```json
{
  "name": "Sahil Sharma",
  "email": "sahil@example.com",
  "password": "securepassword123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sahil Sharma",
    "email": "sahil@example.com",
    "role": "CUSTOMER",
    "isVerified": false,
    "createdAt": "2026-04-16T11:05:34.001Z"
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Name must be at least 2 characters | Zod validation failed |
| 400 | Invalid email format | Zod validation failed |
| 400 | Password must be at least 8 characters | Zod validation failed |
| 409 | Email already registered | Duplicate email |

**Internal Flow:**
1. `validate(registerSchema)` middleware runs `schema.safeParse(req.body)` — on failure, throws `AppError` with the first Zod issue message and a `400` status before the controller ever runs
2. Controller extracts `{ name, email, password }` from `req.body` and calls `authService.register()`
3. `auth.service.register()`:
   - Lowercases the email before lookup and insert — `Sahil@Gmail.com` and `sahil@gmail.com` cannot become two accounts
   - Checks for an existing user via `prisma.user.findUnique({ where: { email: emailLower } })`
   - If found → throws `AppError('Email already registered', 409)`
   - Hashes the password with `bcrypt.hash(password, 10)`
   - Creates the user via `prisma.user.create()` with the hashed password and lowercase email
   - Calls `sendOtp(user.email)` inside **try/catch** — Gmail failure must not fail register. The user already exists; they resend via `POST /auth/send-otp`
   - Destructures the result to strip `password` before returning (`const { password: _, ...userWithoutPassword } = user`)
4. Controller responds `201` with the sanitized user object (`isVerified: false`). The OTP is **not** in the JSON — only in the email

---

#### POST `/auth/login`

**Purpose:** Authenticate a user and issue access + refresh tokens.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No |
| **Middleware Chain** | `validate(loginSchema)` → `loginIpLimiter` → `loginEmailLimiter` → `login` |

**Request Body:**
```json
{
  "email": "sahil@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
> The refresh token is **not** returned in the body. It is set as an HTTP-only cookie named `refreshToken`.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Invalid email format | Zod validation failed |
| 401 | Invalid credentials | Email not found **or** wrong password — deliberately identical message to prevent user enumeration |
| 429 | Too many requests | More than 10 login attempts from this IP **or** against this email in 15 minutes |

**Internal Flow:**
1. Controller extracts `{ email, password }`, calls `authService.login()`
2. `auth.service.login()`:
   - Looks up the user by `email.toLowerCase()`; if absent → `AppError('Invalid credentials', 401)`
   - Compares password with `bcrypt.compare(password, user.password)` (never re-hashes and compares directly — bcrypt salts are random per hash)
   - If mismatch → same `AppError('Invalid credentials', 401)`
   - Generates `accessToken` via `generateAccessToken(user.id, user.role)` — payload carries only `userId` and `role`, **never** email or name, so the token can't go stale if profile fields change
   - Generates a raw `refreshToken` via `generateRefreshToken(user.id)`, SHA-256 hashes it, and stores the **hash** (not the raw token) in the `RefreshToken` table with a 7-day `expiresAt`
   - Returns `{ accessToken, refreshToken: <raw token> }` to the controller
3. Controller sets the raw refresh token as an `httpOnly`, `sameSite: strict` cookie, and returns only the `accessToken` in the JSON body

---

#### GET `/auth/me`

**Purpose:** Return the authenticated user's current profile.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `me` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sahil Sharma",
    "email": "sahil@example.com",
    "role": "CUSTOMER",
    "isVerified": false,
    "createdAt": "2026-04-16T11:05:34.001Z"
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 401 | No token provided | Missing or malformed `Authorization` header |
| 401 | jwt malformed | Token isn't a valid JWT structure |
| 401 | jwt expired | Access token past its 15-minute expiry |
| 401 | Token revoked | Token was blacklisted on logout and is still inside its original 15-minute window |

**Internal Flow:**
1. `protect` middleware verifies the JWT (see [Function Reference](#protect--srcmiddlewaresauthmiddlewarejs)) and attaches the decoded payload to `req.user`
2. Controller calls `authService.getMe(req.user.userId)` rather than trusting the JWT payload for display data
3. Service re-fetches the user **fresh from PostgreSQL** with `prisma.user.findUnique()` and an explicit `select` — guarantees the response always reflects the current name/role/verification status, not a snapshot from token-issue time

---

#### POST `/auth/refresh-token`

**Purpose:** Exchange a valid refresh token cookie for a new access token, rotating the refresh token in the process.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No `protect` — deliberately. A client calling this endpoint already has an **expired** access token, so requiring a valid one would create a deadlock |
| **Middleware Chain** | `refresh` (controller reads the cookie directly) |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
> A new `refreshToken` cookie is set automatically (rotation).

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 401 | No refresh token provided | `refreshToken` cookie missing |
| 401 | Invalid refresh token | Hash not found in DB (already used, or user logged out) |
| 401 | Refresh token expired | Past the 7-day `expiresAt` |

**Internal Flow:**
1. Controller reads `req.cookies.refreshToken`; if absent, throws before calling the service
2. `auth.service.refreshAccessToken()`:
   - SHA-256 hashes the incoming raw token and looks it up via `prisma.refreshToken.findUnique()`
   - Not found → `AppError('Invalid refresh token', 401)`
   - Found but `expiresAt < new Date()` → `AppError('Refresh token expired', 401)`
   - Fetches the owning user to get a fresh `role` for the new access token
   - **Rotation:** deletes the matched token record, generates a brand-new refresh token, hashes it, and inserts a new record — the old token can never be reused even if intercepted
3. Controller sets the new refresh token as a cookie and returns only the new access token in the body

---

#### POST `/auth/logout`

**Purpose:** Revoke the current refresh token and clear the cookie.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `logout` |

**Success Response (200):**
```json
{ "success": true }
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 401 | No refresh token provided | Cookie missing |
| 401 | Invalid token | Hash not found in DB |

**Internal Flow:**
1. `protect` confirms the caller holds a valid (not-yet-expired, not-blacklisted) access token
2. Controller reads `req.cookies.refreshToken` and the Bearer access token, then calls `authService.logout(rawToken, accessToken)`
3. Service looks up the refresh-token hash; if missing, throws — otherwise deletes the `RefreshToken` row
4. Service SHA-256 hashes the **access** token, reads `exp` via `jwt.decode`, and `SET bl:<hash> '1' EX <seconds left>`. After `exp`, `jwt.verify` already fails — no need to keep the key
5. Controller calls `res.clearCookie('refreshToken')`
6. The same Bearer token now fails `protect` with `401 Token revoked` until it would have expired anyway

---

#### POST `/auth/send-otp`

**Purpose:** Send (or resend) a 6-digit email verification code. Also called internally from `register`.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No — the user is not logged in yet |
| **Middleware Chain** | `validate(sendOtpSchema)` → `otpIpLimiter` → `otpEmailLimiter` → `sendOtp` |

**Request Body:**
```json
{
  "email": "sahil@example.com"
}
```

**Success Response (200):**
```json
{ "success": true }
```
> The OTP is **never** in the JSON. It is emailed only. Redis stores `sha256(otp)`, not the raw code.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Invalid email format | Zod validation failed |
| 400 | Already verified | This email's `isVerified` is already `true` |
| 429 | Too many requests | More than 3 send-otp calls from this IP **or** to this email in 15 minutes |

**Internal Flow:**
1. Service lowercases the email
2. Looks up the user. **Not found → return silently.** The controller still sends `200`. A 404 here would let attackers discover which emails are registered (same idea as login's "Invalid credentials")
3. Already verified → `AppError('Already verified', 400)`
4. `crypto.randomInt(100000, 999999)` — not `Math.random()`
5. `SET otp:<email> <sha256(otp)> EX 600`. A second send **overwrites** the key and resets TTL — only one valid code at a time
6. Nodemailer sends the **raw** 6 digits to that inbox. If `sendMail` throws, the error is not swallowed on this route (register is the one that catches it)

---

#### POST `/auth/verify-otp`

**Purpose:** Confirm the emailed code and set `isVerified: true`.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No |
| **Middleware Chain** | `validate(verifyOtpSchema)` → `verifyIpLimiter` → `verifyEmailLimiter` → `verifyOtp` |

**Request Body:**
```json
{
  "email": "sahil@example.com",
  "otp": "482193"
}
```
> `otp` is coerced to a string so a JSON number `482193` still passes.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sahil Sharma",
    "email": "sahil@example.com",
    "role": "CUSTOMER",
    "isVerified": true
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | OTP must be 6 digits | Zod failed (`/^\d{6}$/`) |
| 400 | OTP expired or not found | Redis key missing (never sent, already used, or past 10 minutes) |
| 400 | Invalid OTP | Hash of the submitted code does not match Redis |
| 429 | Too many requests | More than 5 verify attempts from this IP **or** against this email in 15 minutes |

**Internal Flow:**
1. `GET otp:<emailLower>`. Missing → `400 OTP expired or not found`
2. SHA-256 the submitted OTP and compare to the stored hash — never compare raw codes
3. On match: `prisma.user.update({ isVerified: true })`, then `DEL otp:<email>` so the same code cannot be reused
4. Returns the user without `password`

---

### Cart Module

#### POST `/cart/add`

**Purpose:** Increase a product's quantity in the logged-in user's Redis cart (atomic "add N more", not "set to N").

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `cartLimiter` → `validate(addToCartSchema)` → `addToCart` |

**Request Body:**
```json
{
  "productId": "6a02cddc1a14a5f7638e1337",
  "quantity": 1
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      { "productId": "6a02cddc1a14a5f7638e1337", "quantity": 2 }
    ]
  }
}
```
> Quantity `2` after the same request twice — `HINCRBY`, not a second line.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 401 | No token provided / jwt expired / Token revoked | `protect` failed |
| 400 | Invalid product ID | Not a 24-char Mongo ObjectId |
| 400 | Zod min/max | `quantity` not an integer from 1 to 20 (abuse cap — **not** warehouse stock) |
| 404 | Product not found | Missing document or `isActive: false` |
| 429 | Too many requests | More than 60 cart actions from this `userId` in 15 minutes |

**Internal Flow:**
1. `userId` comes from `req.user` (JWT), **never** from the body
2. Service loads the product from Mongo. Redis will store any string — a fake id must not become a cart line
3. `HINCRBY cart:<userId> <productId> <quantity>` — atomic add
4. `EXPIRE` the key for 7 days (`604800` seconds). A new key has no TTL until this runs
5. `HGETALL` + `Number(qty)` — Redis hash values are strings (`"2"` not `2`)

Stock is **not** checked here. Cart is intent; inventory is deducted at checkout (Week 5). Zod `max(20)` only stops a request from writing `100000` into Redis.

---

#### GET `/cart`

**Purpose:** Return the cart with live names, prices, line totals, and a grand total.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `cartLimiter` → `getCart` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6a02cddc1a14a5f7638e1337",
        "name": "OnePlus 12 Pro",
        "price": 64999,
        "quantity": 2,
        "lineTotal": 129998
      }
    ],
    "total": 129998
  }
}
```

**Internal Flow:**
1. `HGETALL cart:<userId>`. Empty / missing key → `{ items: [], total: 0 }` — **200, not 404**
2. `Product.find({ _id: { $in: ids }, isActive: true })` — **one** Mongo round trip, not N `findById`s
3. Build an in-memory map (`_id.toString()` because Redis fields are strings, Mongo `_id` is an ObjectId)
4. Loop the hash in Redis order. Missing/inactive products are skipped (`continue`), not thrown — the product may have been deleted after it was added
5. `lineTotal = price * quantity`; `total` is the sum. The frontend must not compute money
6. GET does **not** refresh TTL

---

#### DELETE `/cart/items/:id`

**Purpose:** Remove that product line entirely (trash-can), regardless of quantity. Decrease-qty (`−` button) is a different future endpoint.

| Field | Details |
|---|---|
| **Method** | `DELETE` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `cartLimiter` → `removeItem` |

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Item not in cart | `HDEL` returned `0` — that field was not in the hash |

**Internal Flow:**
1. `HDEL cart:<userId> <productId>`. `0` → 404
2. If the hash is now empty (`Object.keys(fields).length === 0`) → `DEL` the key. `hGetAll` of an empty hash returns `{}`, which is **truthy** in JS — must not use `if (fields)`
3. If items remain → refresh the 7-day TTL
4. Returns `getCart(userId)`. After deleting the last item the key is gone; `HGETALL` on a missing key returns `{}` and getCart already treats that as an empty cart

---

#### DELETE `/cart`

**Purpose:** Empty the whole cart. Idempotent — already empty is still `200`.

| Field | Details |
|---|---|
| **Method** | `DELETE` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `cartLimiter` → `clearCart` |

**Success Response (200):**
```json
{
  "success": true,
  "data": { "items": [], "total": 0 }
}
```

**Internal Flow:**
1. `DEL cart:<userId>` — Redis `DEL` on a missing key is not an error
2. Return `getCart(userId)` → empty. Clear means “make it empty”; already empty **is** success, unlike remove-one-line which 404s when that line is gone

---

### Address Module

All address routes require `protect`. `userId` comes from the JWT, **never** from the body. `PATCH /:id/default` is registered **before** `PUT /:id` so Express does not treat `"default"` as an `:id`.

Postgres enforces **at most one default per user** with a partial unique index (`WHERE "isDefault" = true`). Prisma 6 cannot declare that `where` in `schema.prisma` — the index is a raw SQL migration. Concurrent first-address creates: one `201`, the other `P2002` → `409`.

---

#### POST `/addresses`

**Purpose:** Save a shipping address for the logged-in user. The first address becomes default even if `isDefault` is omitted.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `validate(createAddressSchema)` → `createAddress` |

**Request Body:**
```json
{
  "fullName": "Sahil Sharma",
  "phone": "9876543210",
  "line1": "123 MG Road",
  "line2": "Near City Mall",
  "city": "Jaipur",
  "state": "Rajasthan",
  "pincode": "302001",
  "isDefault": true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "fullName": "Sahil Sharma",
    "phone": "9876543210",
    "line1": "123 MG Road",
    "line2": "Near City Mall",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302001",
    "isDefault": true
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Phone must be 10 digits / Pincode must be 6 digits | Zod |
| 401 | No token / jwt expired / Token revoked | `protect` |
| 409 | Another address was made default at the same time | Unique index `P2002` — retry |

**Internal Flow:**
1. Inside `$transaction`: look for an existing default for this `userId`
2. `isDefault = data.isDefault === true || !hasDefault` — first address always default
3. If this row will be default, `updateMany` unsets every other default for that user, **then** `create`
4. Both steps in one transaction so a failed insert cannot leave the user with **zero** defaults
5. `P2002` → 409 (two requests both tried to become the only default)

---

#### GET `/addresses`

**Purpose:** List **this** user's addresses. Default first.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `getAddresses` |

**Success Response (200):** `{ "success": true, "data": [ ... ] }` — empty array if none, **not** 404.

**Internal Flow:** `findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })`.

---

#### PUT `/addresses/:id`

**Purpose:** Update fields on an address the user owns. Zod schema is `.partial()` so a body may contain only `city`.

| Field | Details |
|---|---|
| **Method** | `PUT` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `validate(updateAddressSchema)` → `updateAddress` |

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Address not found | No row with this `id` **and** `userId` (someone else's id looks the same) |

**Internal Flow:**
1. `findFirst({ id, userId })` — not yours → 404 (does not confirm the id exists)
2. `isDefault: true` → unset others (`id: { not: id }`), then update
3. `isDefault: false` **and** this row **was** default → after update, promote the newest other address so checkout always has a default
4. All of that in one `$transaction`

---

#### PATCH `/addresses/:id/default`

**Purpose:** Make this address the only default. No body.

| Field | Details |
|---|---|
| **Method** | `PATCH` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `setDefaultAddress` |

**Internal Flow:** Ownership check → if already default, return it → else unset all defaults for the user, set this one `true`, in a transaction.

---

#### DELETE `/addresses/:id`

**Purpose:** Delete an address the user owns.

| Field | Details |
|---|---|
| **Method** | `DELETE` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `deleteAddress` |

**Success Response (200):** `{ "success": true }`

**Internal Flow:**
1. Ownership check → 404 if missing
2. `$transaction`: `delete` the row
3. If it **was** default, `findFirst` remaining for that user (`orderBy: createdAt desc`) and set `isDefault: true`
4. Last address deleted → zero defaults is fine (no one left to promote)

---

### Product Module

#### POST `/products`

**Purpose:** Create a new product (Admin only).

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes (`Bearer <accessToken>`) |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `protect` → `authorize('ADMIN')` → `validate(createProductSchema)` → `createProduct` |

**Request Body:**
```json
{
  "name": "Apple iPhone 15 Pro",
  "description": "Latest iPhone with titanium design",
  "price": 134900,
  "quantity": 50,
  "category": "<category_id>",
  "attributes": [
    { "key": "ram", "value": "8GB" },
    { "key": "storage", "value": "256GB" },
    { "key": "battery", "value": "3274mAh" }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Apple iPhone 15 Pro",
    "slug": "apple-iphone-15-pro",
    "category": "<phones_id>",
    "categoryPath": ["<phones_id>", "<electronics_id>"],
    "attributes": [{ "key": "ram", "value": "8GB" }],
    "isActive": true
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 401 | No token provided | Missing `Authorization` header |
| 403 | Forbidden | Authenticated but role isn't `ADMIN` |
| 400 | Invalid category ID | `category` fails Zod's 24-char ObjectId-length check |

**Internal Flow:**
1. `protect` verifies the JWT → `authorize('ADMIN')` checks `req.user.role` against the allowed list, both **before** the request body is even parsed by Zod
2. `validate(createProductSchema)` coerces `price`/`quantity` to numbers and validates the category ID shape
3. Controller passes `req.body` straight to `productService.createProduct()`
4. `product.service.createProduct()`:
   - Generates the slug via the shared `slugify()` utility — never relies on a Mongoose hook (see [Architecture Decisions](#key-engineering-decisions))
   - Calls the internal `buildCategoryChain(category)` helper, which walks **up** the category tree (child → parent → grandparent) using a `while` loop until it hits a category with no `parent`, collecting every visited `_id` into `categoryPath`
   - Creates the document via `Product.create()` with the generated `slug` and `categoryPath` attached

---

#### GET `/products`

**Purpose:** List products with category, search, attribute, and price filtering, plus pagination.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | No (public) |
| **Middleware Chain** | `publicLimiter` → `cacheMiddleware(600)` → `getProducts` (public, 100 req / 15 min per IP, 10-minute Redis cache) |

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | ObjectId string | — | Matches against `categoryPath`, so a parent category ID returns products from every descendant category too |
| `search` | string | — | Case-insensitive regex match on `name` |
| `attributeKey` + `attributeValue` | string | — | Must be used together; matches one entry inside the `attributes` array via `$elemMatch` |
| `minPrice` / `maxPrice` | number | — | Inclusive price range; non-numeric values are rejected with `400` before reaching MongoDB |
| `page` | number | 1 | Clamped to a minimum of 1 — prevents a negative `$skip` |
| `limit` | number | 10 | Capped at 50 server-side regardless of what's requested — prevents large-payload DoS |

**Example:** `GET /products?category=<phones_id>&minPrice=50000&maxPrice=150000&page=1&limit=20`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [ "...array of product documents, category populated with name + slug" ],
    "pagination": {
      "total": 23,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | minPrice must be a number | `minPrice` isn't numeric |
| 400 | maxPrice must be a number | `maxPrice` isn't numeric |

**Internal Flow:**
1. Destructures all filters from `req.query` with defaults `page = 1, limit = 10`
2. Validates `minPrice`/`maxPrice` with `isNaN(Number(...))` **before** building any query object — failing fast avoids leaking a raw Mongoose `CastError` (which would expose internal stack traces) to the client
3. Builds the `query` object incrementally:
   - `isActive: true` always included
   - `category` → cast to `new mongoose.Types.ObjectId(category)` and matched with `categoryPath: { $in: [...] }`, which is what makes parent-category filtering work without recursive lookups
   - `search` → `{ name: { $regex: search, $options: 'i' } }`
   - `attributeKey` + `attributeValue` → `{ attributes: { $elemMatch: { key, value } } }`
   - price range → builds `query.price.$gte` / `.$lte` only for the bounds that were actually supplied
4. Computes `pageNum = Math.max(1, Number(page))` and `limitNum = Math.min(Number(limit), 50)`, then `skip = (pageNum - 1) * limitNum`
5. Runs the product fetch and the total count **in parallel** with `Promise.all([Product.find(query)..., Product.countDocuments(query)])` — halves the wait time versus sequential `await` calls since neither query depends on the other's result
6. Returns `products` alongside a `pagination` object built from `pageNum`/`limitNum`/`total`

---

#### GET `/products/filters`

**Purpose:** Return every unique attribute key and its possible values for a given category, so the frontend can render filter checkboxes without hardcoding anything.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | No (public) |
| **Middleware Chain** | `getProductFilters` — registered **before** `GET /products/:slug` in the router so Express doesn't mistake `filters` for a slug |

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `category` | Yes | Must be a valid 24-char MongoDB ObjectId |

**Example:** `GET /products/filters?category=<phones_id>`

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    { "key": "battery", "values": ["3274mAh", "4000mAh", "5400mAh"] },
    { "key": "ram", "values": ["4GB", "8GB", "12GB"] },
    { "key": "storage", "values": ["64GB", "128GB", "256GB", "512GB"] }
  ]
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Category is required | `category` query param omitted — this endpoint is intentionally never global, since mixing attribute keys across unrelated categories (e.g. phone RAM with clothing size) would be meaningless to a frontend |
| 400 | Invalid category ID | `category` isn't a valid ObjectId — checked with `mongoose.Types.ObjectId.isValid()` **before** it's used in the aggregation, so an invalid string never reaches MongoDB as a raw query |

**Internal Flow:**
1. Validates `category` is present, then valid, in that order
2. Runs a MongoDB aggregation pipeline against the `Product` collection:
   - `$match` — `isActive: true` and `categoryPath: { $in: [categoryObjectId] }`
   - `$unwind: '$attributes'` — explodes each product's attribute array so every `{ key, value }` pair becomes its own pipeline document
   - `$group` — groups by `attributes.key`, collecting all values into a set with `$addToSet` (automatically deduplicates)
   - `$project` — reshapes `_id` (the grouped key) into a `key` field and drops `_id` from the output
   - `$sort: { key: 1 }` — alphabetical ordering for a predictable UI
3. Returns the aggregation result directly — no further transformation needed

---

#### GET `/products/:slug`

**Purpose:** Fetch a single product by its slug.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | No (public) |

**Success Response (200):**
```json
{
  "success": true,
  "data": { "...full product document, category populated" }
}
```

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Product not found | No document matches the slug |

**Internal Flow:**
1. `Product.findOne({ slug }).populate('category', 'name slug')` — only `name` and `slug` are pulled from the referenced category to keep the payload lean
2. `null` result → `AppError('Product not found', 404)`

---

#### PUT `/products/:id`

**Purpose:** Update a product by its MongoDB `_id` (Admin only).

| Field | Details |
|---|---|
| **Method** | `PUT` |
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `protect` → `authorize('ADMIN')` → `updateProduct` |

**Request Body (all fields optional):**
```json
{ "name": "Apple iPhone 15 Pro Max", "price": 159900 }
```

**Internal Flow:**
1. **Why `:id` and not `:slug`?** The slug is derived from `name`. If a request updates `name`, the slug the client used to reach this route would already be stale by the time the update lands — `_id` never changes, so it's the only safe identifier for a mutation
2. If `updateData.name` is present, the service regenerates `updateData.slug = slugify(updateData.name)` **before** calling Mongoose — `findByIdAndUpdate()` is query-level middleware and does **not** trigger the model's `pre('save')` hooks, so relying on a hook here would silently produce a stale slug
3. `Product.findByIdAndUpdate(id, updateData, { new: true })` — `{ new: true }` returns the document *after* the update instead of the pre-update snapshot
4. `null` result → `AppError('Product not found', 404)`

---

#### DELETE `/products/:id`

**Purpose:** Soft-delete a product (Admin only).

| Field | Details |
|---|---|
| **Method** | `DELETE` |
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |

**Success Response (200):**
```json
{ "success": true, "message": "Product deleted successfully" }
```

**Internal Flow:**
1. `Product.findByIdAndUpdate(id, { isActive: false })` — the document is never removed from MongoDB
2. Every public read query (`getProducts`, `getProductBySlug`, `getProductFilters`) filters on `isActive: true`, so the product disappears from the catalog without losing historical data (e.g. for past orders that reference it)

---

#### POST `/products/:id/images`

**Purpose:** Upload a product image to Cloudinary and append its URL to the product.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `protect` → `authorize('ADMIN')` → `upload.single('image')` → `uploadProductImage` |
| **Request Type** | `multipart/form-data`, field name `image`, max 5MB, images only |

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | No image provided | `req.file` undefined — no file in the form-data |
| 500 (via multer) | only images allowed | `fileFilter` rejected a non-`image/*` mimetype |
| 404 | Product not found | `id` doesn't match any product |

**Internal Flow:**
1. `upload.single('image')` (Multer, configured with `memoryStorage()`) buffers the file **in RAM** rather than writing a temp file to disk — avoids the read/write/cleanup cycle a disk-based approach would need, and works identically across multiple server instances since nothing is written locally
2. Controller checks `req.file` exists before calling the service
3. Service fetches the product by `id`; not found → `404`
4. Wraps Cloudinary's callback-based `uploader.upload_stream()` in a `new Promise()` so it can be `await`-ed like any other async call, streaming `req.file.buffer` directly into the `ecommerce/products` folder
5. Pushes the returned `secure_url` into `product.images[]` and calls `product.save()`

---

### Category Module

#### POST `/categories`

**Purpose:** Create a category, optionally as a child of an existing one (Admin only).

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `protect` → `authorize('ADMIN')` → `createCategory` |

**Request Body:**
```json
{
  "name": "Phones",
  "description": "Smartphones and mobile phones",
  "parent": "<electronics_category_id>"
}
```
> `parent` is optional — omit it to create a top-level category.

**Internal Flow:**
1. Service generates `slug = slugify(name)`
2. `Category.create({ name, slug, description, parent, image })` — `parent` defaults to `null` in the schema if omitted, marking it top-level

---

#### GET `/categories`

**Purpose:** List categories, optionally filtered by parent.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | No (public) |
| **Middleware Chain** | `publicLimiter` → `cacheMiddleware(600)` → `getCategories` |

**Query Parameters:**

| Param | Value | Behavior |
|---|---|---|
| _(none)_ | — | Returns every active category |
| `parent` | `null` | Returns only top-level categories (`parent: null`) |
| `parent` | `<categoryId>` | Returns direct children of that category |

**Internal Flow:**
1. Builds `query = { isActive: true }`
2. If `filters.parent === 'null'` (string, since query params are always strings) → `query.parent = null`
3. Else if `filters.parent` is a truthy non-`'null'` string → `query.parent = filters.parent`
4. `Category.find(query).populate('parent', 'name slug')`

---

#### GET `/categories/:slug`

**Purpose:** Fetch a single category by slug, with its parent populated.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Category not found | No active category matches the slug |

---

#### PUT `/categories/:id`

**Purpose:** Update a category (Admin only). Same slug-regeneration logic as product updates — `slugify()` is called explicitly when `name` changes.

---

#### DELETE `/categories/:id`

**Purpose:** Soft-delete a category, but only if it has no active products (Admin only).

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Cannot delete category with active products | `Product.countDocuments({ category: id, isActive: true })` returned `> 0` |
| 404 | Category not found | `id` doesn't match any category |

**Internal Flow:**
1. Counts active products referencing this category's `_id` directly
2. If any exist, the deletion is **blocked** rather than cascading — this was a deliberate design choice over two alternatives: silently doing nothing (leaves stale data visible) or cascading the soft-delete to every product (too easy to trigger by accident and wipe out an entire catalog section). Blocking forces the admin to consciously move or remove products first
3. If the count is zero, proceeds to `findByIdAndUpdate(id, { isActive: false })`

---

#### POST `/categories/:id/image`

**Purpose:** Upload/replace a category's image.

**Internal Flow:** Identical pattern to product image upload, except the category schema stores a single `image: String` rather than an array — so the service **assigns** `category.image = result.secure_url` instead of pushing to an array.

---

### Orders Module

#### POST `/orders/checkout`

**Purpose:** Turn the Redis cart into a PostgreSQL order, decrement Mongo stock, and create a Razorpay order. Money is **not** captured yet — status is `PENDING` until webhook/verify.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `validate(checkoutSchema)` → `checkout` |

**Request Body:**
```json
{
  "addressId": "ad18fcff-44da-4c36-ba37-ac1a3dd7ff8e"
}
```
> `addressId` must be a UUID (Zod). Amount is **never** taken from the client.

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "status": "PENDING",
    "total": "100.00",
    "fullName": "Sahil Sharma",
    "phone": "9876543210",
    "line1": "123 MG Road",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302001",
    "items": [
      {
        "productId": "6a103adfa0a1a0b4e51ea1f6",
        "name": "Test Product",
        "price": "100.00",
        "quantity": 1,
        "lineTotal": "100.00"
      }
    ],
    "payment": {
      "razorpayOrderId": "order_xxxxxxxx",
      "razorpayPaymentId": null,
      "amount": "100.00",
      "status": "PENDING"
    }
  }
}
```
> Prisma `Decimal` often serializes as a **string**. After this call the Redis cart is empty and Mongo `quantity` is reduced.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Invalid address ID | Zod — not a UUID |
| 400 | Cart is empty | Redis hash missing or no fields |
| 400 | Not enough stock | Mongo `findOneAndUpdate` returned `null` (`quantity < qty` or inactive) |
| 403 | Forbidden | Address exists but `userId` does not match JWT |
| 404 | Address not found | No row with that id |
| 401 | No token / jwt expired / Token revoked | `protect` |

**Internal Flow:**
1. `prisma.address.findUnique({ id })`. Missing → 404. `address.userId !== userId` → **403** (checkout confirms the id exists; address **update** still uses 404 for “not yours”)
2. `HGETALL cart:<userId>`. No fields → 400. Empty cart is still a cart — this is a bad request, not a missing resource
3. For each hash field: `Product.findOneAndUpdate({ _id, isActive: true, quantity: { $gte: qty } }, { $inc: { quantity: -qty } }, { new: true })`. `null` → throw 400 after rolling back lines already decremented (`restoreStock`)
4. Snapshot **name, price, quantity, lineTotal** onto each `OrderItem`. Sum `total`. Price is **not** read from Mongo later
5. `razorpayInstance.orders.create({ amount: Math.round(Number(total) * 100), currency: 'INR', receipt: 'rcpt_' + Date.now() })`. Amount is **paise** (integer). Receipt must be ≤ 40 characters (`order_${userId}_${Date.now()}` is too long)
6. `prisma.order.create` with nested `items.create` and `payment.create` (`PENDING`, `razorpayOrderId`). Nested writes are one Postgres transaction
7. **Then** `clearCart(userId)` and `invalidateCache('cache:/products')`. Cache must drop or `GET /products` still shows the old quantity (slug is uncached and was already correct)
8. `catch`: `restoreStock(taken)` then rethrow. Razorpay/Prisma failure must not leave stock gone. Cart is only cleared after step 6 succeeds

Checkout does **not** trust a client-sent total. Razorpay Checkout is opened with this `order_id` and `RAZORPAY_KEY_ID` only.

---

#### GET `/orders`

**Purpose:** List the logged-in user's orders, newest first.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `getOrders` |

**Success Response (200):** `{ "success": true, "data": [ ... ] }` — empty array if none, **not** 404.

**Internal Flow:** `findMany({ where: { userId }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } })`. Registered as `GET /` **before** `GET /:id`.

---

#### GET `/orders/:id`

**Purpose:** Fetch one order the user owns, with line items and payment.

| Field | Details |
|---|---|
| **Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `getOrder` |

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Order not found | No row with that id |
| 403 | Forbidden | Row exists, `order.userId !== req.user.userId` |

**Internal Flow:**
1. `findUnique({ id, include: items + payment })`
2. Missing → 404
3. Wrong owner → 403 (same choice as checkout address — “it exists, not yours”)
4. Compare `order.userId` to **`userId`**, not to `orderId` (that bug 403s even on your own order)

---

#### POST `/orders/:id/cancel`

**Purpose:** Cancel an order. PENDING restores stock immediately. PAID starts a Razorpay refund; stock returns when the **webhook** says the refund finished.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware Chain** | `protect` → `cancelOrder` |

**Success Response (200):**
```json
{ "success": true, "message": "Order cancelled" }
```
PAID path: `{ "success": true, "message": "Refund initiated, this may take a few days", "payment": { ... } }`.

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 404 | Order not found | No row |
| 403 | Forbidden | Not the owner |
| 400 | Order cannot be cancelled - already processed | `updateMany` `count === 0` (two clicks, or status already moved) |
| 400 | Order cannot be cancelled - current status: … | `CANCELLED` / `FAILED` |
| 400 | No captured payment found / Refund already initiated | PAID path |

**Internal Flow (PENDING):**
1. Load order + items + payment; 404 / 403 as above
2. `updateMany({ id, status: 'PENDING' }, { status: 'CANCELLED' })` **first** — claims the row so two cancels cannot both restore stock
3. `count === 0` → 400
4. `restoreStock(order.items)` (`$inc` quantity back in Mongo)
5. `invalidateCache('cache:/products')`

**Internal Flow (PAID):**
1. `initiateRefund`: require `razorpayPaymentId`; `updateMany` `CAPTURED` → `REFUND_INITIATED` (`count === 0` → already refunding)
2. Call Razorpay `payments.refund`. If that throws, set payment back to `CAPTURED` and rethrow
3. Stock is **not** restored here. `refund.processed` webhook runs `finishRefund`

---

### Payments Module

Razorpay **test** keys live in `.env`. The browser only ever sees `KEY_ID` + `order_id`. Webhooks cannot hit `localhost` — use `npx ngrok http 3000` and set the dashboard URL to `https://<host>/payments/webhook`. Events: `payment.captured`, `refund.processed`.

A local `pay.html` (Razorpay Checkout.js) is for trying a card in the browser. **Do not commit** it with a real `key` or `order_id`. Indian **test** card e.g. `4386 2894 0766 0153` — `4111…` is treated as international and is rejected. Test mode has a **max amount**; seed products over ~₹1 lakh fail — checkout a cheap product. Disable **Magic Checkout** (OTP to a phone) under Checkout Features; use Standard Checkout + Card.

`app.js` stores the raw request bytes:

```javascript
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf }
}))
```

---

#### POST `/payments/verify`

**Purpose:** Confirm a Checkout `handler` payload. HMAC uses `KEY_SECRET` on `order_id|payment_id`. Then the same `capturePayment` as the webhook.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No — authenticity is the signature |
| **Middleware Chain** | `verifyPayment` |

**Request Body:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "hex"
}
```

**Success Response (200):** `{ "success": true, "data": { "status": "CAPTURED", ... } }`

**Error Responses:**

| Status | Message | Cause |
|---|---|---|
| 400 | Invalid signature | HMAC mismatch |
| 404 | Payment not found | No Payment row with that `razorpayOrderId` |

**Internal Flow:**
1. `HMAC-SHA256(KEY_SECRET, orderId + '|' + paymentId)` vs `razorpay_signature`
2. `capturePayment(orderId, paymentId)`

---

#### POST `/payments/webhook`

**Purpose:** Razorpay server callback. HMAC of **raw body** with `WEBHOOK_SECRET` (not the key secret). Header: `x-razorpay-signature`.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No |
| **Middleware Chain** | `razorpayWebhook` |

**Success Response (200):** `{ "success": true }` even when the event is ignored — so Razorpay does not retry forever on events we do not handle.

**Internal Flow:**
1. `HMAC-SHA256(WEBHOOK_SECRET, req.rawBody)` vs header. Re-serializing `req.body` can change bytes and fail the signature
2. `payment.captured` → `capturePayment(entity.order_id, entity.id)`
3. `refund.processed` → `handleRefundProcessed(entity.payment_id)`
4. Any other event → `{ received: true }`

---

##### `capturePayment(razorpayOrderId, razorpayPaymentId)` *(shared)*

1. `findUnique({ razorpayOrderId })` — field is `@unique` (required for `findUnique`; a missing unique threw at runtime until the migration)
2. Missing → 404
3. `status !== 'PENDING'` → return as-is (**idempotent**: verify and webhook can race)
4. `$transaction`: payment `CAPTURED` + `razorpayPaymentId`, order `PAID`

##### `handleRefundProcessed` / `finishRefund`

1. Find payment by `razorpayPaymentId`
2. `updateMany` `REFUND_INITIATED` → `REFUNDED` (claim)
3. `finishRefund(orderId)` always:
   - Load order + items
   - Already `CANCELLED` → return (no second `$inc`)
   - Else restore stock, set order `CANCELLED`, `invalidateCache('cache:/products')`
4. If the process died after `REFUNDED` but before cancel, a retry still calls `finishRefund` and completes the order/stock side

`restoreStock` lives in `src/utils/stock.js` so `order.service` and `payment.service` can both use it **without a require cycle**.

---

## 🧩 Function & Middleware Reference
## 🧩 Function & Middleware Reference

> Only functions with non-trivial internal logic are documented here. Simple pass-through controllers are omitted.

### `slugify(text)`

| Detail | Value |
|---|---|
| **File** | `src/utils/slugify.js` |
| **Purpose** | Convert any string into a URL-safe, deduplicated, edge-trimmed slug |
| **Input** | `text` (String) — e.g. a product or category name |
| **Output** | String — lowercase, hyphenated slug |

**Internal Logic (in order):**
1. `.toLowerCase()`
2. `.trim()` — strips leading/trailing **whitespace** first
3. `.replace(/\s+/g, '-')` — collapses **one or more** consecutive spaces into a single hyphen (the `+` quantifier is what prevents `"a  b"` from becoming `"a--b"`)
4. `.replace(/[^\w-]+/g, '')` — strips any character that isn't a word character or hyphen (handles punctuation like `!`, `#`, `&`)
5. `.replace(/--+/g, '-')` — collapses any hyphens that ended up adjacent after step 4 removed characters between them
6. `.replace(/^-+|-+$/g, '')` — trims hyphens specifically from the start/end — necessary even after step 2's whitespace trim, because step 4 can introduce **new** edge hyphens by deleting a leading/trailing special character (e.g. `"#Phone"` becomes `"-Phone"` after steps 3/4, which the earlier whitespace trim never catches)

**Example:** `"  Apple   iPhone #15 Pro!!  "` → `"apple-iphone-15-pro"`

**Why it's a standalone utility and not a Mongoose hook:** `pre('save')` hooks don't fire on `findByIdAndUpdate()`, which every update endpoint in this project uses. Centralizing the logic here means both `create*` and `update*` service functions call the exact same implementation explicitly — no hidden, inconsistent behavior depending on which Mongoose method happens to be used.

---

### `buildCategoryChain(categoryId)` *(internal helper, not exported)*

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Purpose** | Walk a category's ancestry from itself up to the root, collecting every ID along the way |
| **Input** | `categoryId` — the product's direct category `_id` |
| **Output** | Array of ObjectIds, e.g. `[phonesId, electronicsId]` |

**Internal Logic:**
1. Fetches the starting category document
2. Loops with a `while (current)` condition — **not recursion**:
   - Pushes `current.id` onto the chain
   - If `current.parent` is falsy (top of the tree) → `break`
   - Otherwise fetches the parent document and continues the loop with it as the new `current`
3. Returns the accumulated chain once the loop exits

**Why `while` instead of recursion:** Recursive tree traversal uses the call stack — one frame per level. A corrupted dataset where a category's `parent` accidentally points back into its own ancestry would cause infinite recursion and a stack overflow that crashes the whole process. A `while` loop has no stack growth and can be bounded with an explicit safety counter if needed, failing gracefully instead of crashing.

**Why this exists at all:** Products store `category` (their direct category) **and** `categoryPath` (every ancestor). This is what lets `GET /products?category=<electronicsId>` return phones and laptops — products that don't belong to Electronics directly, but whose `categoryPath` includes it.

---

### `auth.service.register(name, email, password)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Output** | User object without the `password` field |

**Internal Logic:**
1. `emailLower = email.toLowerCase()` — service owns storage shape; Zod only trims and checks format
2. `prisma.user.findUnique({ where: { email: emailLower } })` — if a row exists, throws `AppError('Email already registered', 409)`
3. `bcrypt.hash(password, 10)` — 10 salt rounds, the standard balance between brute-force resistance and login latency
4. `prisma.user.create()` with the hashed password and lowercase email
5. `try { await sendOtp(user.email) } catch` — user row is already committed; a Gmail `535` must not turn into a failed register and a `409` on retry
6. `const { password: _, ...userWithoutPassword } = user` — destructures the password into a discarded `_` variable (a common JS convention for "I am intentionally ignoring this") because `password` was already a function parameter name and can't be redeclared with `const` in the same scope

---

### `auth.service.login(email, password)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Output** | `{ accessToken, refreshToken }` |

**Internal Logic:**
1. Looks up the user; not found → `AppError('Invalid credentials', 401)`
2. `await bcrypt.compare(password, user.password)` — **never** re-hashes the input password and compares hashes directly, because bcrypt embeds a random salt in every hash it produces, so hashing the same password twice never yields the same output. `compare()` extracts the salt from the stored hash internally and reproduces the comparison correctly
3. Mismatch → the exact same `AppError('Invalid credentials', 401)` used for "email not found" — a deliberate choice to prevent **user enumeration**: if the two failure cases returned different messages, an attacker could use the API to discover which emails are registered
4. `generateAccessToken(user.id, user.role)` — payload is intentionally minimal (`userId`, `role` only); see [tokenUtils](#tokenutilsjs--generateaccesstoken--generaterefreshtoken)
5. `generateRefreshToken(user.id)` produces the raw token returned to the client; the service then SHA-256 hashes it and stores **only the hash** via `prisma.refreshToken.create()` with a 7-day `expiresAt` — if the database were ever breached, stolen hashes are useless without the original token

---

### `auth.service.refreshAccessToken(rawToken)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Output** | `{ accessToken, refreshToken }` (a *new* pair) |

**Internal Logic:**
1. Hashes `rawToken` with SHA-256 and looks up the hash in `RefreshToken`
2. Not found → `AppError('Invalid refresh token', 401)` (covers both tampering and a token that's already been rotated/logged out)
3. `tokenRecord.expiresAt < new Date()` → `AppError('Refresh token expired', 401)`
4. Re-fetches the user to get a **current** `role` for the new access token (not trusted from anywhere else)
5. **Rotation, in order:** delete the old `RefreshToken` row → generate a new raw token → hash it → insert a new row. Deleting first means even if something fails immediately after, the compromised/used token can never be replayed
6. Returns the new pair; the controller sets the new refresh token as a cookie and returns only the new access token in the response body

---

### `auth.service.logout(rawToken, accessToken)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |

**Internal Logic:**
1. Hashes the incoming **refresh** token, looks it up
2. Not found → `AppError('Invalid token', 401)` — this check happens **before** any delete call (an earlier version of this function called `delete()` before checking existence, which crashed on `null`)
3. Deletes the matching `RefreshToken` row
4. SHA-256 hashes the **access** token (same reason refresh tokens are hashed: a Redis `KEYS bl:*` dump must not be a usable Bearer token)
5. `jwt.decode(accessToken)` only to read `exp` — `protect` already verified the signature
6. `ttl = decoded.exp - now` (seconds). `ttl > 0` → `SET bl:<hash> '1' EX ttl`. A fixed 15-minute TTL would keep a token that had 30 seconds left around for another 15 minutes

---

### `auth.service.sendOtp(email)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |

**Internal Logic:**
1. Lowercase email, find user. Missing user → `return` (HTTP still 200)
2. `isVerified` → `400 Already verified`
3. `crypto.randomInt(100000, 999999).toString()`
4. Store `sha256(otp)` at `otp:<email>` with `EX 600`
5. Email the raw OTP via the shared Nodemailer transporter in `src/config/mailer.js`

---

### `auth.service.verifyOtp(email, otp)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Output** | User object without `password`, `isVerified: true` |

**Internal Logic:**
1. `GET otp:<email>` — missing means expired, never sent, or already used
2. Hash the submitted code the same way send did; string-compare hashes
3. `prisma.user.update({ isVerified: true })` then `DEL` the Redis key — delete **after** success so a crash mid-update can still be retried with the same code

---

### `cart.service.addToCart(userId, productId, quantity)`

| Detail | Value |
|---|---|
| **File** | `src/services/cart.service.js` |
| **Output** | `{ items: [{ productId, quantity }] }` |

**Internal Logic:**
1. Mongo `findById` — inactive/missing → 404
2. `HINCRBY cart:<userId> productId quantity` — “add N more”, atomic
3. `EXPIRE` 7 days
4. `HGETALL` + `Number(qty)` because Redis hash values are strings

---

### `cart.service.getCart(userId)`

| Detail | Value |
|---|---|
| **File** | `src/services/cart.service.js` |
| **Output** | `{ items: [{ productId, name, price, quantity, lineTotal }], total }` |

**Internal Logic:**
1. Empty hash → `{ items: [], total: 0 }`
2. `Product.find({ _id: { $in: ids }, isActive: true })` — one query
3. Map keyed by `_id.toString()` so Redis string fields match
4. Skip ids that are not in the map (deleted/inactive after add)

---

### `cart.service.removeItem(userId, productId)` / `clearCart(userId)`

**removeItem:** `HDEL` → 0 means 404. Empty hash → `DEL` the key (must use `Object.keys(fields).length`, not `if (fields)`). Remaining items → refresh TTL. Then `getCart`.

**clearCart:** `DEL cart:<userId>` then `getCart`. Missing key is fine — already empty is success.

---

### `product.service.getProducts(filters)`

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Output** | `{ products, pagination }` |

**Internal Logic:**
1. Validates `minPrice`/`maxPrice` numeric-ness **before** touching the query object — letting an invalid value flow into `query.price.$gte = Number("abc")` would store `NaN`, which Mongoose rejects with an unfiltered `CastError` that leaks internal stack details to the client
2. Builds `query` conditionally — every filter (`category`, `search`, price range, `attributeKey`/`attributeValue`) is only added if actually supplied, so an empty query string returns the full active catalog
3. `category` is cast with `new mongoose.Types.ObjectId(category)` before being placed in `categoryPath: { $in: [...] }` — query params arrive as plain strings, and MongoDB will not match a string against a stored ObjectId without this explicit cast
4. `pageNum = Math.max(1, Number(page))` guards against `page=0` or negative values, which MongoDB's `$skip` rejects outright with a server error
5. `limitNum = Math.min(Number(limit), 50)` hard-caps the page size — without this, a request like `?limit=1000000` would force MongoDB to scan and serialize an unbounded result set, a trivial denial-of-service vector
6. `Promise.all([Product.find(...), Product.countDocuments(...)])` — runs the page fetch and the total count concurrently since neither depends on the other's result, roughly halving total latency versus two sequential `await`s

---

### `product.service.getProductFilters(filters)`

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Output** | `[{ key, values }]` |

**Internal Logic:**
1. Requires `category` — without it, attribute keys from unrelated categories (phone `ram` mixed with clothing `size`) would be returned together, which is meaningless for a frontend filter panel
2. Validates the ObjectId format with `mongoose.Types.ObjectId.isValid()` before constructing the aggregation — an invalid string passed straight to `new ObjectId()` throws an unguarded error
3. Aggregation pipeline:
   - `$match` — active products whose `categoryPath` contains the given category
   - `$unwind: '$attributes'` — turns a product with 5 attributes into 5 separate pipeline documents, each carrying one `{ key, value }` pair
   - `$group` — buckets by `attributes.key`, collecting every value into a set via `$addToSet` (deduplicates automatically, unlike `$push`)
   - `$project` — renames the grouped `_id` to `key` and removes the now-redundant `_id` field from the output
   - `$sort: { key: 1 }` — alphabetical, so the frontend gets a stable, predictable order

---

### `protect` — `src/middlewares/auth.middleware.js`

| Detail | Value |
|---|---|
| **Purpose** | Verify the access token and attach its payload to `req.user` |
| **Wrapped in** | `asyncHandler` — so a thrown `jwt.verify()` error (expired/malformed) flows to the global error handler instead of crashing the request unhandled |

**Internal Logic:**
1. Reads `req.headers.authorization`; missing or not prefixed with `"Bearer "` → `AppError('No token provided', 401)`
2. `authHeader.split(' ')[1]` — splitting `"Bearer <token>"` on the space character produces `["Bearer", "<token>"]`; index `1` is the token itself
3. `jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)` — throws `TokenExpiredError` or `JsonWebTokenError` on failure, both caught by the `asyncHandler` wrapper and forwarded to `errorHandler`
4. On success, SHA-256 the raw token and `EXISTS bl:<hash>`. Hit → `AppError('Token revoked', 401)`. Order: **verify first** (garbage JWTs never hit Redis), then blacklist
5. `req.user = decoded` (contains `userId` and `role`) and calls `next()`

---

### `authorize(...roles)` — `src/middlewares/authorize.js`

| Detail | Value |
|---|---|
| **Purpose** | Higher-order function (middleware factory) that returns a role-checking middleware |
| **Input** | Any number of allowed role strings, e.g. `authorize('ADMIN')` or `authorize('ADMIN', 'MODERATOR')` |
| **Output** | An Express middleware function |

**Internal Logic:**
1. `(...roles) => (req, res, next) => { ... }` — the outer function captures `roles` in a closure; the inner function is what Express actually invokes per-request and still has access to `roles` even though the outer call already finished
2. `if (!roles.includes(req.user.role))` → `next(new AppError('Forbidden', 403))`
3. Otherwise `next()`
4. Always runs **after** `protect` in the middleware chain — `protect` is what populates `req.user` in the first place

---

### `validate(schema)` — `src/middlewares/validate.js`

| Detail | Value |
|---|---|
| **Purpose** | Middleware factory wrapping any Zod schema for use as route middleware |

**Internal Logic:**
1. `schema.safeParse(req.body)` — used instead of `.parse()` because `safeParse` never throws; it returns `{ success, data }` or `{ success: false, error }`, letting the middleware control exactly how validation failures are reported
2. On failure, `result.error.issues.map(e => e.message)` collects every Zod issue message, and only the **first** one is passed into `AppError(..., 400)` — keeps error responses simple rather than dumping a full validation report
3. On success, `req.body = result.data` — replaces the raw body with Zod's parsed/coerced version (e.g. `z.coerce.number()` outputs), so downstream code never has to re-validate or re-cast

---

### `asyncHandler(fn)` — `src/utils/asyncHandler.js`

| Detail | Value |
|---|---|
| **Purpose** | Eliminate repeated `try/catch` blocks in every async controller/middleware |

**Internal Logic:**
```js
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
}
```
1. Takes a controller function `fn` and returns a **new** function with the exact `(req, res, next)` signature Express expects
2. `Promise.resolve(fn(...))` normalizes the call so that even a controller that throws synchronously is caught — wrapping a non-promise value in `Promise.resolve()` still produces a promise whose `.catch()` is reachable
3. `.catch(next)` forwards any rejection straight to Express's `next()`, which routes it to `errorHandler` — without this wrapper, every controller would need its own `try { } catch (err) { next(err) }` block

---

### `errorHandler(err, req, res, next)` — `src/middlewares/errorHandler.js`

| Detail | Value |
|---|---|
| **Purpose** | Single, centralized place where every error in the app — operational or not — becomes an HTTP response |
| **Registration** | Mounted **last** in `app.js`, after every route — Express only routes to an error-handling middleware (recognized by its 4-argument signature) when something upstream calls `next(err)` |

**Internal Logic:**
1. `statusCode = err.statusCode || 500` — defaults to `500` for errors that didn't originate from `AppError` (i.e. unexpected bugs)
2. In `development`: always returns the real `err.message` plus `err.stack` — full visibility while debugging locally
3. In `production`: returns `err.message` **only if** `err.isOperational === true` (i.e. it came from `AppError`); otherwise returns a generic `"Something went wrong"` — prevents leaking internal implementation details (file paths, library names, query structure) to real users or attackers probing the API

---

### `AppError` — `src/utils/AppError.js`

| Detail | Value |
|---|---|
| **Purpose** | A custom `Error` subclass that carries an HTTP status code and an "expected error" flag |

**Internal Logic:**
```js
class AppError extends Error {
    constructor(message, statusCode) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = true
    }
}
```
- `super(message)` — delegates to the built-in `Error` constructor so `.message` and `.stack` still behave normally
- `isOperational = true` is the flag `errorHandler` checks to distinguish "a user did something the API anticipated" (wrong password, duplicate email, missing field) from "something broke that nobody anticipated" (a bug, a DB outage) — only the former is ever shown to the client in production

---

### `tokenUtils.js` — `generateAccessToken` / `generateRefreshToken`

| Detail | Value |
|---|---|
| **File** | `src/utils/tokenUtils.js` |

**Internal Logic:**
```js
const generateAccessToken = (userId, role) =>
    jwt.sign({ userId, role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY })

const generateRefreshToken = (userId) =>
    jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY })
```
- The access token payload intentionally carries `role` (accepted tradeoff: a 15-minute window where a demoted admin could still act as one, in exchange for not hitting the DB on every single request just to check permissions)
- The refresh token payload carries **only** `userId` — its sole purpose is minting new access tokens, so it doesn't need `role` at all
- Each uses a **separate secret** (`ACCESS_TOKEN_SECRET` vs `REFRESH_TOKEN_SECRET`) — a leaked access-token secret can't be used to forge refresh tokens, and vice versa

---

### `seedProducts.js` — `src/scripts/seedProducts.js`

| Detail | Value |
|---|---|
| **Purpose** | Populate MongoDB with realistic demo products across every existing category, in one command |
| **Run with** | `npm run seed` |

**Internal Logic:**
1. Connects to MongoDB directly (`mongoose.connect()`) — this script runs **outside** Express entirely; it has no HTTP context, so it talks to Mongoose models directly rather than going through the service layer (which expects `req`-shaped data and is optimized for one document at a time, not bulk inserts)
2. Fetches all active categories and builds a `slug → document` lookup map
3. `generateAttributes(categoryType)` returns a different realistic attribute set per category slug (phones get `ram`/`storage`/`battery`/`screenSize`/`camera`; laptops get `processor`/`ram`/`storage`/`screenSize`/`graphics`; clothing gets `size`/`material`/`fit`/`gender`; books get `author`/`language`/`pages`/`genre`; anything else falls back to a generic `color` attribute)
4. For each entry in a hardcoded `PRODUCT_TYPES` list (category slug + desired count), builds each product's `categoryPath` from the category's stored `parent` field — this mirrors `buildCategoryChain()` from the service layer, but without an extra DB round-trip per product, since the category documents are already loaded into memory
5. Deletes any previously-seeded data first via `Product.deleteMany({ isSeeded: true })`, then inserts the new batch with `Product.insertMany()` — bulk insert is significantly faster than calling `createProduct()` in a loop, since it's a single round-trip to MongoDB instead of one per document
6. Every seeded document is flagged `isSeeded: true`, which is what makes step 5 possible without ever touching real, manually-created products (which default to `isSeeded: false`)
7. Disconnects and calls `process.exit(0)` on success, or logs the error and exits with code `1` on failure — standard practice for CLI scripts so they can be chained in CI/automation and their exit code reflects success/failure

---

### `cacheMiddleware(ttl)` — `src/middlewares/cache.js`

| Detail | Value |
|---|---|
| **Purpose** | Cache successful GET JSON in Redis; rebuild under a distributed lock on miss |
| **Input** | `ttl` in **seconds** (lists use `600`) |

**Internal Logic:**
1. Key = `cache:` + `req.originalUrl` (path + query)
2. Lock key = `lock:` + `req.originalUrl` — different prefix so `SCAN cache:/products*` never deletes the lock
3. Cache hit → `JSON.parse` and return `200`
4. `acquireLock` (`SET NX EX 10` + random UUID). Failure → wait/retry GET; still empty → `next()` without a lock
5. Success → replace `res.json` (`.bind(res)` so `this` stays the response). `setEx` only when `data.success === true`. `releaseLock` in `finally` so errors still unlock
6. `next()` is **not** awaited — Express does not return a Promise for the rest of the chain

---

### `acquireLock` / `releaseLock` / `invalidateCache` — `src/utils/cache.js`

**acquireLock:** `SET key token NX EX ttl`. Returns the token or `null`. `NX` is what makes the lock exclusive.

**releaseLock:** `GET` then `DEL` only if the stored value equals this request's token — you must not delete someone else's lock after yours expired. (A Lua compare-and-del is the stricter version at huge scale; GET+DEL is the version in this repo.)

**invalidateCache(prefix):** `SCAN` with `MATCH prefix*` until cursor is `'0'`. `DEL` each batch. Errors are logged, never thrown — a write must not fail because cache cleanup failed.

---

### `order.service.checkout(userId, addressId)`

| Detail | Value |
|---|---|
| **File** | `src/services/order.service.js` |
| **Output** | Order with `items` and `payment`, status `PENDING` |

**Internal Logic:**
1. Address `findUnique` → 404 / 403 (wrong owner)
2. Redis `hGetAll('cart:' + userId)` — empty → 400
3. Loop lines: atomic Mongo decrement; push `{ productId, quantity }` onto `taken` for rollback
4. Build snapshots and `total`
5. Razorpay order (`Math.round(Number(total) * 100)`, `rcpt_${Date.now()}`)
6. Prisma nested create (order + items + payment with `razorpayOrderId`)
7. `clearCart` then `invalidateCache('cache:/products')` — without the cache drop, `GET /products` served stale quantity for 10 minutes
8. `catch` → `restoreStock(taken)` then rethrow. Nested Prisma create is already one SQL transaction; Mongo/Razorpay are not in it

---

### `order.service.getOrder(userId, orderId)` / `getOrders(userId)`

**getOrders:** `findMany` where `userId`, include items + payment, `createdAt desc`. Empty list is a valid 200.

**getOrder:** `findUnique` by id, include items + payment. Missing 404. `order.userId !== userId` → 403. Must compare to **userId**, not `orderId`.

---

### `order.service.cancelOrder(userId, orderId)`

**Internal Logic:**
1. Load with items + payment; 404 / 403
2. **PENDING:** `updateMany` where still `PENDING` → `CANCELLED`. `count === 0` → 400 (lost the race). Then `restoreStock` + invalidate cache
3. **PAID:** `paymentService.initiateRefund(order)` — does not restore stock
4. Else 400 with current status

---

### `restoreStock(items)` — `src/utils/stock.js`

For each `{ productId, quantity }`, `findByIdAndUpdate` `$inc: { quantity: +n }`. Shared by checkout `catch`, PENDING cancel, and `finishRefund`. Kept out of `order.service` / `payment.service` so those two files never `require` each other (cycle).

---

### `payment.service.capturePayment(razorpayOrderId, razorpayPaymentId)`

| Detail | Value |
|---|---|
| **File** | `src/services/payment.service.js` |

**Internal Logic:**
1. `findUnique({ razorpayOrderId })` — column is `@unique` (migration `add_unique_razorpay_order_id`). `findUnique` on a non-unique field throws
2. Not `PENDING` → return (idempotent)
3. `$transaction`: payment `CAPTURED` + order `PAID`

Called from **both** `verifyPayment` (Checkout HMAC) and `handleWebhook` (`payment.captured`).

---

### `payment.service.verifyPayment(body)` / `handleWebhook(rawBody, signature, payload)`

**verifyPayment:** HMAC of `orderId|paymentId` with `RAZORPAY_KEY_SECRET`, then `capturePayment`.

**handleWebhook:** HMAC of **raw Buffer** with `RAZORPAY_WEBHOOK_SECRET` vs `x-razorpay-signature`. `payment.captured` → `capturePayment`. `refund.processed` → `handleRefundProcessed`. Other events ignored with 200.

**handleRefundProcessed:** `updateMany` `REFUND_INITIATED` → `REFUNDED`, then `finishRefund`. `finishRefund` no-ops if order is already `CANCELLED`; otherwise restores stock, sets `CANCELLED`, invalidates product cache.

**initiateRefund:** `updateMany` `CAPTURED` → `REFUND_INITIATED` (`count === 0` → already in flight). Then Razorpay `refund`. On Razorpay error, payment is set back to `CAPTURED`.

---

## ⏱ Rate Limiting

All counters live in Redis (`rate-limit-redis`) so two Node processes share one count. In-memory limits would reset on restart and double under two instances.

Each limiter is a **named export** (`loginIpLimiter`, `otpEmailLimiter`, …) — two checks on a route are two middlewares you can see, not a factory.

| Policy | Identity | Limit / 15 min | Applied on |
|--------|----------|----------------|------------|
| Login | IP **and** email (two counters) | 10 each | `POST /auth/login` |
| OTP send | IP **and** email | 3 each | `POST /auth/send-otp` |
| OTP verify | IP **and** email | 5 each | `POST /auth/verify-otp` |
| Public | IP only | 100 | `GET /products`, `GET /products/filters`, `GET /products/:slug`, `GET /categories`, `GET /categories/:slug` |
| Cart | `userId` (after `protect`) | 60 | All `/cart` routes |

`protect` **before** `cartLimiter` — there is no `userId` until the JWT is verified.

Auth order: `validate` → limiter → controller, so email exists for the email counter.

IP-only limiters omit a custom `keyGenerator`. Passing `(req) => req.ip` throws `ERR_ERL_KEY_GEN_IPV6` — express-rate-limit's default already handles IPv6.

Over limit → `AppError('Too many requests', 429)`.

Redis prefixes: `rl:login:ip:`, `rl:login:email:`, `rl:otp:ip:`, `rl:otp:email:`, `rl:verify:ip:`, `rl:verify:email:`, `rl:public:ip:`, `rl:cart:user:`.

---

## 🧊 Response Caching

Public **lists** are cached. Single-product / single-category GETs by slug are not — one Mongo `findOne` is cheap, and the plan called for listings.

| Route | TTL | Redis key example |
|-------|-----|-------------------|
| `GET /products` (+ query string) | 600s | `cache:/products`, `cache:/products?page=2` |
| `GET /categories` (+ query string) | 600s | `cache:/categories`, `cache:/categories?parent=null` |

**Read path (`cacheMiddleware`):**
1. `GET cache:<originalUrl>` — hit → parse and return, Mongo skipped
2. Miss → `SET lock:<originalUrl> NX EX 10`
   - Got the lock → wrap `res.json`, `next()`, controller + Mongo run
   - No lock → poll Redis 10 × 50ms; if still empty, `next()` (fail-open)
3. On `res.json`: if `data.success === true`, `setEx` the body; **always** `releaseLock` in `finally`
4. Redis errors on the outer `GET` → `next(error)` / waiters still fall through to Mongo if the wait loop expires

**Write path (service, after Mongo succeeds):**

| After | Deletes |
|-------|---------|
| Product create / update / delete / image | `cache:/products*` |
| Category create / update / delete / image | `cache:/categories*` **and** `cache:/products*` |

`await invalidateCache(...)` so the HTTP response is not sent while old keys still exist.

Homepage / top-rated lists were **not** added — there is no `rating` field. `GET /products` + `GET /categories` are the homepage payload.

---

## 🗄 Database Schema

### PostgreSQL (via Prisma)

#### User
```
id          String    UUID, Primary Key
name        String    User's display name
email       String    Unique
password    String    bcrypt hashed, never returned in responses
isVerified  Boolean   Default: false (flipped to true by POST /auth/verify-otp)
role        Enum      CUSTOMER | ADMIN, Default: CUSTOMER
createdAt   DateTime  Auto-set on creation
updatedAt   DateTime  Auto-updated on every change
```

#### RefreshToken
```
id          String    UUID, Primary Key
token       String    Unique, SHA-256 hashed before storage
userId      String    Foreign Key -> User.id
expiresAt   DateTime  7 days from creation
createdAt   DateTime  Auto-set on creation
```
**Relationship:** One User → Many RefreshTokens (multi-device support). Foreign key uses `ON DELETE RESTRICT` — a user with active refresh tokens can't be deleted until those tokens are removed first.

#### Address
```
id          String    UUID, Primary Key
userId      String    Foreign Key -> User.id
fullName    String
phone       String    10 digits (validated in Zod, not the DB)
line1       String
line2       String?   Optional
city        String
state       String
pincode     String    6 digits (Zod)
isDefault   Boolean   Default: false
createdAt   DateTime
updatedAt   DateTime
```
**Relationship:** One User → Many Addresses.

**Partial unique index** `one_default_address_per_user` on `"userId"` **where** `"isDefault" = true` (raw SQL migration). Many `false` rows per user are allowed. A second `true` is `P2002`. Prisma 6 cannot declare `@@unique(..., where)` — do not `db pull` expecting that to appear as schema `where`.

#### Order
```
id          String    UUID, Primary Key
userId      String    Foreign Key -> User.id
status      Enum      PENDING | PAID | FAILED | CANCELLED, Default: PENDING
total       Decimal(12,2)
fullName, phone, line1, line2?, city, state, pincode
            copied from Address at checkout — later address edits do not rewrite old bills
createdAt   DateTime
updatedAt   DateTime
```
**Relationship:** One User → Many Orders. One Order → Many OrderItems. One Order → One Payment (`orderId` unique on Payment).

#### OrderItem
```
id          String    UUID, Primary Key
orderId     String    Foreign Key -> Order.id
productId   String    Mongo `_id` as text — **not** a Postgres FK
name        String    snapshot
price       Decimal(12,2)  snapshot
quantity    Int
lineTotal   Decimal(12,2)  price * quantity stored so history is stable
```

#### Payment
```
id                  String    UUID, Primary Key
orderId             String    Unique, FK -> Order.id
razorpayOrderId     String?   Unique (required for Prisma `findUnique`)
razorpayPaymentId   String?
amount              Decimal(12,2)
status              Enum      PENDING | CAPTURED | FAILED | REFUND_INITIATED | REFUNDED
createdAt           DateTime
updatedAt           DateTime
```

---

#### User (relations added in Week 5)
`addresses Address[]` and `orders Order[]` on the User model.

### MongoDB (via Mongoose)

#### Product
```
name          String      Required
slug          String      Unique, generated via slugify()
description   String      Required
price         Number      Required
quantity      Number      Default: 0
images        [String]    Cloudinary URLs
category      ObjectId    Reference -> Category (direct parent only)
categoryPath  [ObjectId]  Full ancestry chain - enables parent-category filtering
attributes    [{key, value}]  Flexible key-value pairs, indexed on both fields
isActive      Boolean     Default: true (soft delete)
isSeeded      Boolean     Default: false (distinguishes seed script data from real data)
```
**Indexes:** `{ isActive: 1, category: 1, price: 1 }` compound index covers the most common query shape in one pass; `{ 'attributes.key': 1, 'attributes.value': 1 }` supports attribute filtering.

#### Category
```
name        String      Required
slug        String      Unique, generated via slugify()
description String      Optional
image       String      Cloudinary URL, optional
parent      ObjectId    Self-reference -> Category (null for top-level)
isActive    Boolean     Default: true
```
**Relationship:** Self-referencing — a category's `parent` points to another document in the *same* collection, which is what allows arbitrarily nested categories without a separate "Category Tree" model.

### Redis (no schema file — key prefixes are the contract)

| Key | Type | Value | TTL | Purpose |
|-----|------|-------|-----|---------|
| `cart:<userId>` | HASH | field = productId, value = quantity | 7 days, refresh on write | Shopping cart |
| `otp:<email>` | STRING | SHA-256 of the 6-digit code | 10 minutes | Email verification |
| `bl:<sha256(accessToken)>` | STRING | `1` | remaining JWT lifetime | Access-token denylist |
| `rl:<policy>:<identity>:*` | STRING | counter (library-managed) | 15 minutes | Rate-limit buckets |
| `cache:<originalUrl>` | STRING | JSON success envelope | 10 minutes | GET list responses |
| `lock:<originalUrl>` | STRING | lock owner UUID | 10 seconds | Stampede: only one miss rebuilds the cache |

Inspect with Memurai CLI (`memurai-cli` on Windows): `HGETALL cart:<userId>`, `TTL otp:<email>`, `GET cache:/products`, `KEYS cache:*`.

---

## 🔍 Pagination & Filtering

All list endpoints follow a consistent pattern:

```
GET /products?page=2&limit=20&category=<id>&minPrice=10000&maxPrice=80000&search=iphone
```

Responses always include a `pagination` object:
```json
{
  "pagination": {
    "total": 85,
    "page": 2,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Built-in protections** (see [`getProducts` internal logic](#productservicegetproductsfilters) for exactly where each is applied):
- `page` minimum is 1 — negative/zero pages rejected before reaching MongoDB
- `limit` maximum is 50 — prevents large-payload denial-of-service requests
- Non-numeric `minPrice`/`maxPrice` returns `400` with a clear message instead of a raw Mongoose `CastError`
- Invalid category ObjectId format returns `400` before it's used in any query

---

## ❌ Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable description of what went wrong"
}
```

In development mode, responses also include:
```json
{
  "success": false,
  "message": "Error message",
  "stack": "Full stack trace for debugging"
}
```

### Error Categories

| Status | Type | Examples |
|--------|------|---------|
| 400 | Bad Request | Validation failed, invalid ObjectId format, invalid/expired OTP, quantity out of range |
| 401 | Unauthorized | Missing/expired/invalid token, missing/invalid refresh token |
| 403 | Forbidden | Authenticated but not `ADMIN`; address/order belongs to another user |
| 404 | Not Found | Product, category, address, or order doesn't exist |
| 409 | Conflict | Duplicate email; concurrent second default address (`P2002`) |
| 429 | Too Many Requests | Rate limiter tripped (auth, public, or cart) |
| 500 | Server Error | Unexpected crash — details hidden in production |

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js v18+
- PostgreSQL 14+
- MongoDB 6+
- Redis (Memurai on Windows works as a drop-in)
- npm or yarn
- A Gmail account with 2-Step Verification and an **App Password** (normal Gmail password will get `535 BadCredentials`)
- Razorpay **test** account (optional until you hit checkout). Webhooks locally: `npx ngrok http 3000`

### 1. Clone the repository
```bash
git clone https://github.com/Sahil27122/e-commerce.git
cd e-commerce
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```

### 4. Create the PostgreSQL database
```sql
CREATE DATABASE "e-commerce";
```

### 5. Run Prisma migrations
```bash
npx prisma migrate dev
```

### 6. Seed the database (optional)
```bash
npm run seed
```

### 7. Start Redis
Memurai (Windows) or `redis-server` must be running on `localhost:6379` before `npm run dev`. Cart, OTP, blacklist, and rate limits all need it. `server.js` connects Redis **before** loading Express so the rate-limit store is not created against a closed client.

### 8. Start the server
```bash
npm run dev       # Development (with hot reload)
npm start         # Production
```

### .env.example
```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/e-commerce"

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ecommerce

# JWT
ACCESS_TOKEN_SECRET=your_64_char_random_secret_here
REFRESH_TOKEN_SECRET=your_other_64_char_random_secret_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gmail (OTP) — App Password, 16 characters, no spaces
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=abcdefghijklmnop

# Razorpay (test keys — never commit secrets)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🧪 API Testing

### cURL Examples

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Sahil Sharma","email":"sahil@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"sahil@example.com","password":"password123"}'
```

**Get Products with filters:**
```bash
curl "http://localhost:3000/products?category=<id>&minPrice=50000&maxPrice=150000&page=1"
```

**Get Dynamic Filters:**
```bash
curl "http://localhost:3000/products/filters?category=<phones_id>"
```

**Create Product (Admin):**
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"name":"Samsung S24","description":"Flagship phone","price":79999,"quantity":30,"category":"<id>","attributes":[{"key":"ram","value":"8GB"}]}'
```

**Upload Product Image:**
```bash
curl -X POST http://localhost:3000/products/<id>/images \
  -H "Authorization: Bearer <admin_token>" \
  -F "image=@/path/to/image.jpg"
```

**Refresh Token:**
```bash
curl -X POST http://localhost:3000/auth/refresh-token \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <your_access_token>" \
  -b cookies.txt
```

**Send OTP:**
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"sahil@example.com"}'
```

**Verify OTP:**
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"sahil@example.com","otp":"482193"}'
```

**Add to cart:**
```bash
curl -X POST http://localhost:3000/cart/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_access_token>" \
  -d '{"productId":"<24_char_mongo_id>","quantity":1}'
```

**Get cart:**
```bash
curl http://localhost:3000/cart \
  -H "Authorization: Bearer <your_access_token>"
```

**Remove one cart line:**
```bash
curl -X DELETE http://localhost:3000/cart/items/<productId> \
  -H "Authorization: Bearer <your_access_token>"
```

**Clear cart:**
```bash
curl -X DELETE http://localhost:3000/cart \
  -H "Authorization: Bearer <your_access_token>"
```

**Create address:**
```bash
curl -X POST http://localhost:3000/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_access_token>" \
  -d '{"fullName":"Sahil Sharma","phone":"9876543210","line1":"123 MG Road","city":"Jaipur","state":"Rajasthan","pincode":"302001"}'
```

**Checkout:**
```bash
curl -X POST http://localhost:3000/orders/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_access_token>" \
  -d '{"addressId":"<uuid>"}'
```

**List / get / cancel orders:**
```bash
curl http://localhost:3000/orders -H "Authorization: Bearer <your_access_token>"
curl http://localhost:3000/orders/<orderId> -H "Authorization: Bearer <your_access_token>"
curl -X POST http://localhost:3000/orders/<orderId>/cancel \
  -H "Authorization: Bearer <your_access_token>"
```

**Razorpay (after Checkout in a browser / `pay.html` locally):**
```bash
curl -X POST http://localhost:3000/payments/verify \
  -H "Content-Type: application/json" \
  -d '{"razorpay_order_id":"order_xxx","razorpay_payment_id":"pay_xxx","razorpay_signature":"hex"}'
```
Webhook is sent by Razorpay to `https://<ngrok>/payments/webhook`, not by curl (HMAC is over the raw body).

---

## 🧠 What I Learned

### Week 1 — Auth & PostgreSQL

**Engineering Concepts:**
- **Layered architecture** — Why separating routes, controllers, and services makes code reusable across HTTP, CLI, and background jobs
- **JWT security** — The full lifecycle of access + refresh tokens, why short expiry matters, and why HTTP-only cookies protect against XSS
- **Defense in depth** — Why hashing refresh tokens protects users even if the database is compromised
- **Error handling patterns** — Distinguishing operational errors (user's fault) from programmer errors (your fault)

**Challenges Faced:**
- **Token naming conflicts** — Destructuring a variable with the same name as a function parameter. Solved with a `password: _` alias pattern
- **Zod v4 breaking change** — `.errors` renamed to `.issues`. Debugged by reading the actual error object structure
- **URL encoding in connection strings** — Special characters in PostgreSQL passwords must be percent-encoded
- **bcrypt comparison misconception** — bcrypt uses a random salt per hash, making re-hashing impossible — `bcrypt.compare()` is the only correct approach

### Week 2 — MongoDB Product Catalog

**Engineering Concepts:**
- **SQL vs NoSQL tradeoffs** — Evaluated based on data shape and relationships, not popularity. Products have variable attributes that would require sparse columns or an EAV pattern in SQL
- **Materialized path pattern** — Storing the full category ancestry chain on each product enables parent-category filtering with a single `$in` query instead of recursive lookups
- **MongoDB aggregation pipeline** — Used `$unwind`, `$group`, `$addToSet` to build a dynamic filter endpoint that extracts unique attribute values per category
- **Compound indexes** — Indexing `{ isActive, category, price }` together covers the most common query pattern rather than three separate indexes
- **Denormalization tradeoffs** — `categoryPath` costs extra write complexity but makes reads extremely fast — the right tradeoff for e-commerce, where reads vastly outnumber writes
- **Input validation as security** — An uncapped `limit` enables DoS attacks, a negative `page` crashes MongoDB's `$skip`, and an unvalidated ObjectId exposes raw `CastError` internals

**Challenges Faced:**
- **Pre-hook inconsistency** — Mongoose's `pre('save')` hook doesn't fire on `findByIdAndUpdate()`. Discovered when updating a product's name didn't regenerate its slug. Solved by extracting slug generation into a shared `slugify()` utility called explicitly in both create and update service functions
- **Parent category filtering gap** — `GET /products?category=electronicsId` returned an empty array because products belong directly to "Phones," not "Electronics." Solved by introducing `categoryPath` — an array storing the full ancestry chain so any ancestor ID matches
- **Multer/Express 5 incompatibility** — A multer release candidate broke `memoryStorage` under Express 5 with an "Unexpected end of form" error. Solved by pinning to the LTS release
- **ObjectId vs string comparison** — Query params arrive as strings, but MongoDB stores ObjectIds. `$in: [category]` never matched until explicitly wrapping with `new mongoose.Types.ObjectId(category)`
- **Mongoose 7+ async hook syntax** — Pre-save hooks require an `async function()` with no `next` parameter; the older callback style produced a confusing "next is not a function" error

### Week 3 — Redis: Cart, OTP, Blacklist, Rate Limits

**Engineering Concepts:**
- **Right store for the job** — Cart is intent (Redis hash + TTL). Price and name stay in Mongo. Money will stay in Postgres. Redis here is not a product cache
- **Atomic hash ops** — `HINCRBY` vs read-modify-write JSON; why add is increment not set
- **N+1 vs `$in`** — GET cart used to call `findById` per line; one `Product.find({ _id: { $in: ids } })` plus an in-memory map is the same result with one round trip
- **JWT denylist** — Stateless tokens cannot be unsigned; Redis `bl:<hash>` with TTL = remaining `exp` makes logout actually kill the access token
- **OTP as a short secret** — SHA-256 + 10 min TTL + delete-after-use + rate limit, not bcrypt
- **Two rate-limit identities** — IP counter and email counter must both pass; a glued `ip+email` key is not the same thing
- **Layer ownership** — Zod trims/validates; the service lowercases email so jobs and `register → sendOtp` stay consistent

**Challenges Faced:**
- **Gmail 535 BadCredentials** — Normal Gmail password is rejected. App Passwords are 16 characters; Google displays them with spaces (`19` chars). SMTP needs the 16 with **no spaces**
- **Register vs mail failure** — User row is created before `sendMail`. Without try/catch, a 535 made register look like it failed; retry then hit `409`. Catch on register only; resend stays `POST /auth/send-otp`
- **Email case** — Mixed-case register + lowercased `sendOtp` lookup sent no mail. Service now stores and queries lowercase
- **Empty hash is truthy** — `hGetAll` after the last `HDEL` returns `{}`. `if (fields)` never deleted the key. Same check as getCart: `Object.keys(fields).length === 0`
- **`Object.key` vs `Object.keys`** — A missing `s` threw `Object.key is not a function` on remove. The stack pointed at the exact line
- **Rate-limit store before Redis connect** — Requiring `app` (which loads `rateLimit.js`) before `connectRedis()` threw `ClientClosedError`. `server.js` now connects first, then `require('./src/app')`
- **ERR_ERL_KEY_GEN_IPV6** — Custom `keyGenerator: (req) => req.ip` is rejected. IP-only limiters use the library default; email/userId keep a custom generator

### Week 4 — Response Cache, Invalidation, Stampede Lock

**Engineering Concepts:**
- **Cache-aside** — Redis holds a copy of the GET JSON, not the catalog. Mongo stays source of truth. Miss → Mongo → `setEx`
- **Key = URL** — query string is part of identity; one global `cache:products` key is a correctness bug
- **Fail-open** — Redis down still serves the shop; only success bodies are stored
- **Invalidate after write** — `SCAN` + prefix delete from the service, after Mongo succeeds, `await`ed so the next GET cannot race the old key
- **SCAN vs KEYS** — `KEYS` blocks the Redis process; `SCAN` is chunked; cursor is a string
- **Cache stampede** — `SET NX` lock so one miss rebuilds; waiters poll then read. Lock released in `res.json`, not after `next()`
- **Versioning (not shipped)** — bump a version in the key instead of deleting; old keys die on TTL. Extra memory until expiry; skipped at this scale

**Challenges Faced:**
- **Middleware not mounted** — `cache.js` existed but `GET /products` did not use it. Redis `GET cache:/products` was `(nil)` until `cacheMiddleware(600)` was on the route
- **Guessing the Redis key** — Postman URL and `originalUrl` must match. `KEYS cache:*` shows the real key; don't guess `?page=1` if the client omitted it
- **Caching errors** — wrapped `res.json` also wraps the error handler. Guard with `data.success === true`
- **`await next()` released the lock too soon** — Express `next()` is not a Promise for the controller. Waiters stampeded. Fix: `releaseLock` in `res.json` `finally`
- **SCAN infinite loop** — Redis returns cursor `"0"`. `!== 0` is always true for the string `"0"`. Loop until `cursor !== '0'`
- **Stale product list after category rename** — product GET populates category name. Category writes must also `invalidateCache('cache:/products')`

### Week 5 — Addresses, Orders, Razorpay

**Engineering Concepts:**
- **Cart vs order** — Redis may expire; a bill cannot. Postgres stores Order + OrderItem + Payment. Redis cart is copied then deleted
- **Snapshots** — name, price, lineTotal, and shipping fields are copied at checkout. Catalog or address edits later must not rewrite history
- **No Postgres FK to Mongo** — `OrderItem.productId` is a string. Two databases cannot share a foreign key
- **Stock race** — read-then-write oversells. `findOneAndUpdate` with `quantity: { $gte: qty }` and `$inc: -qty` is one atomic check. Failures call `restoreStock` (`$inc` the other way)
- **Clear cart last** — Redis is not in the Prisma transaction. Create the bill first; then `DEL` the hash
- **Two DBs, no distributed transaction** — Mongo decrement + Postgres insert + Razorpay create. Compensate (restore stock) instead of 2PC
- **Webhook vs Checkout verify** — HMAC of **raw body** + webhook secret vs HMAC of `order_id|payment_id` + key secret. Both call `capturePayment`. If status is not `PENDING`, return — either can arrive first
- **Paise** — Razorpay `amount` is integer paise. `Math.round(Number(total) * 100)` because `0.45` is not exact in IEEE floats
- **Partial unique index** — at most one `isDefault: true` per `userId`. App `count` outside a lock is not enough. Index lives in raw SQL on Prisma 6
- **Claim then mutate** — `updateMany` where `PENDING` / `CAPTURED` / `REFUND_INITIATED` before restoring stock. Two cancels or two webhooks cannot both `$inc`
- **403 vs 404** — checkout/get-order: address/order exists but is not yours → 403. Address **update**: `id` + `userId` miss → 404 so we do not confirm the uuid
- **`utils/stock.js`** — `restoreStock` shared by checkout catch, PENDING cancel, and refund webhook without `order.service` ↔ `payment.service` require cycles

**Challenges Faced:**
- **Checkout did not invalidate product cache** — `GET /products` still showed old `quantity`; `GET /products/:slug` (uncached) was already correct. Stock writes must call `invalidateCache('cache:/products')`
- **`findUnique` on non-unique `razorpayOrderId`** — Prisma throws until `@unique` + migrate (or `findFirst`)
- **Receipt > 40 characters** — `order_${userId}_${Date.now()}` rejected by Razorpay; `rcpt_${Date.now()}`
- **International test card** — `4111…` → “international card not supported”. Indian test Visa `4386 2894 0766 0153`
- **Max amount exceeded** — test mode cap; seed prices ~₹1.3 lakh fail. Checkout a product under ₹1000
- **Magic Checkout OTP** — dashboard Checkout Features; disable Magic / OTP; Standard Checkout + Card
- **ngrok not in PATH** — `npx ngrok http 3000` after authtoken; webhook URL must match the current `https://….ngrok-free.app/payments/webhook`
- **`pay.html`** — local browser harness only; never push `key` / `order_id`
- **`restoreStock is not defined` in payment.service** — importing it from `order.service` would cycle; moved to `utils/stock.js`
- **Prisma 6 vs `partialIndexes`** — `@@unique(..., where)` needs Prisma 7.4+; `migrate --create-only` + raw `CREATE UNIQUE INDEX ... WHERE "isDefault" = true`
- **`getOrders` called `getOrder`** — one-order function without `orderId` → 404. Controller must call `getOrders` (with **s**)
- **`order.userId !== orderId`** — compared user uuid to order uuid; 403 on your own order. Compare to `userId`
- **PUT `isDefault: false` on the default** — left zero defaults until promote-another was added (same idea as delete-default)

---

## 🤝 Contributing

This is an open learning project. Frontend developers are welcome to build on top of this API. If you find a bug or want to suggest an improvement, feel free to open an issue or pull request.

---

## 📄 License

MIT License — free to use for personal and commercial projects.

---

<p align="center">Built from scratch as a learning project — no boilerplate, no AI-generated code, every line understood.</p>
