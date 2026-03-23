---
name: stacks-types
description: Use when working with TypeScript type definitions in a Stacks application — model types, request types, environment variables, event types, billing types, attribute types, or auto-imported globals. Covers storage/framework/types/ and storage/framework/core/types/src/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Types

## Key Paths
- Core types: `storage/framework/core/types/src/`
- Generated types: `storage/framework/types/`
- ORM globals: `storage/framework/types/orm-globals.d.ts`
- Environment: `storage/framework/types/env.d.ts`
- Components: `storage/framework/types/components.d.ts`
- Router: `storage/framework/types/router.d.ts`
- Events: `storage/framework/types/events.ts`
- Attributes: `storage/framework/types/attributes.ts`

## Authentication Types (auth.ts)

```typescript
interface AuthConfig {
  default: string
  guards: { [key: string]: { driver: 'session' | 'token', provider: string } }
  providers: { [key: string]: { driver: 'database', table: string } }
  username: string
  password: string
  tokenExpiry: number           // 30 days
  tokenRotation: number         // 7 days
  defaultAbilities: string[]
  defaultTokenName: string
}
```

## ORM Global Types (orm-globals.d.ts)

```typescript
// Full database row — model attributes + system fields + FK columns
type ModelRow<T> = { id: number, uuid: string, created_at: string, updated_at: string } & ModelAttributes<T>

// Insertable data — all fields optional
type NewModelData<T> = Partial<ModelAttributes<T>>

// Updateable data — all fields optional
type UpdateModelData<T> = Partial<ModelAttributes<T>>

// Model-aware request — narrows field names to model's attributes
interface RequestInstance<TModel> {
  get(key: keyof TModel): any
  all(): TModel
  validate(): Promise<void>
}
```

## Environment Types (env.d.ts)

```typescript
// Application
APP_NAME, APP_ENV: 'local' | 'dev' | 'stage' | 'prod', APP_KEY, APP_URL, PORT, DEBUG

// Database
DB_CONNECTION: 'mysql' | 'sqlite' | 'postgres' | 'dynamodb'
DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD

// AWS
AWS_ACCOUNT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION

// Mail
MAIL_MAILER: 'smtp' | 'mailgun' | 'ses' | 'postmark' | 'sendmail' | 'log'
MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_NAME, MAIL_FROM_ADDRESS

// Search
SEARCH_ENGINE_DRIVER: 'meilisearch' | 'algolia' | 'typesense'
MEILISEARCH_HOST, MEILISEARCH_KEY

// Frontend
FRONTEND_APP_ENV: 'development' | 'staging' | 'production', FRONTEND_APP_URL
```

## Event Types (events.ts)

All model CRUD events: `model:created`, `model:updated`, `model:deleted`

- **Content**: author, post, page
- **Core**: user, activity, campaign, comment, email-list, notification, social-post, subscription, tag
- **Commerce (30+ models)**: cart, cart-item, category, coupon, customer, order, order-item, payment, product, product-variant, review, shipping-method, shipping-rate, tax-rate, transaction, gift-card, license-key, and more

All payloads are `Record<string, any>`.

## Billing Types (billing.ts)

```typescript
interface TransactionHistory {
  id?, uuid?, name, description?, amount, type, provider_id?, user_id?, paymentmethod_id?, created_at, updated_at?
}

interface PaymentMethod {
  id?, uuid?, type, last_four, brand, exp_month, exp_year, is_default?, provider_id?, user_id?
}

interface Product {
  id?, uuid?, name, key, unit_price?, status?, image?, provider_id?
}

interface Subscription {
  id?, uuid?, type, provider_id, provider_status, provider_type, unit_price?, quantity?, trial_ends_at?, ends_at?, user_id?
}
```

## Attribute Types (attributes.ts)

200+ attribute definitions covering all models:

| Category | Fields |
|----------|--------|
| Basic | name, slug, description, title, subject, content, body |
| Dates | created_at, updated_at, published_at, scheduled_at, expires_at |
| Commerce | unit_price, price, amount, tax_amount, discount_amount, total, currency |
| User | email, password, phone, avatar, author_name, author_email |
| Shipping | delivery_address, delivery_fee, region, countries |
| Loyalty | loyalty_points_earned, loyalty_points_redeemed, points_required |
| Analytics | views, conversions, clicks, reach, likes, shares |

## Request Types (traits.d.ts)

Auto-generated per model:

```typescript
interface PasskeysRequestType extends Request {
  get(key: 'id' | 'cred_public_key' | 'user_id' | 'counter' | ...): any
}

interface CommentablesRequestType extends Request {
  get(key: 'title' | 'body' | 'status' | 'commentables_id' | ...): any
}
```

## Auto-Imported Globals

### Framework Modules
`Action`, `response`, `route`, `Router`, `schema`, `validate`, `slug`, `camelCase`, `pascalCase`, `snakeCase`, `kebabCase`, `titleCase`, `path`, `storage`, `log`, `handleError`, `Auth`, `register`

### 60+ ORM Models (globally available)
User, Team, Post, Page, Author, Comment, Product, Order, Cart, Customer, Coupon, Category, Tag, Payment, Subscription, Driver, ShippingRate, GiftCard, LicenseKey, Job, FailedJob, Error, Log, Notification, and many more.

### 150+ Vue Components (components.d.ts)
Dashboard, Commerce, Billing, Forms, Marketing, UI Elements, Forum components — all globally registered.

### Actions Type
```typescript
type ActionPath = 'Actions/LogAction' | 'Actions/HealthAction' | 'Actions/ExampleAction' | (string & {})
```

## CLI Types (cli.ts)

```typescript
interface CliOptions {
  verbose?: boolean, silent?: boolean, quiet?: boolean
  cwd?: string, background?: boolean, timeoutMs?: number, project?: string
}

interface CleanOptions extends CliOptions {}
interface CommitOptions extends CliOptions {}
interface FreshOptions extends CliOptions { dryRun?: boolean }
```

## Gotchas
- **Types are auto-generated** — many files in `storage/framework/types/` are generated from model definitions
- **ORM globals are truly global** — `ModelRow<T>`, `NewModelData<T>` available without imports
- **RequestInstance is model-aware** — `.get()` and `.all()` narrowed to model's fields when typed
- **Event payloads are untyped** — all `Record<string, any>`, not strongly typed per-model
- **Env types augment Bun.env** — `Bun.env.DB_CONNECTION` is typed
- **Attributes is a shared type** — 200+ fields covering ALL models, not per-model
- **Router types auto-generated** — 130+ typed route definitions, regenerated when routes change
- **Components.d.ts has 150+ entries** — globally registered, no imports needed
