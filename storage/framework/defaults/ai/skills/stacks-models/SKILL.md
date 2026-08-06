---
name: stacks-models
description: Use when working with data models in Stacks — the defineModel() API, model attributes with validation and factories, relationships (hasOne/hasMany/belongsTo/belongsToMany), traits (useAuth, useUuid, useTimestamps, useSearch, useApi, billable, taggable, categorizable, commentable, likeable, observe), computed properties (get/set), model generation, and the 50+ built-in framework models. Covers model definitions and storage/framework/defaults/app/Models/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Models

## Key Paths
- Your models: `app/Models/` (create it; it does not exist in a fresh project)
- Built-in models: `storage/framework/defaults/app/Models/` (62 files, grouped
  into `commerce/`, `Content/`, `realtime/` and a flat top level)
- `ModelOptions` / `Attribute` types: `storage/framework/core/types/src/model.ts`
- Attribute presets: `storage/framework/types/attributes.ts`

To customize a built-in model, create the same filename under `app/Models/` -
`app/Models/User.ts` wins over the default. `buddy publish:model User` copies the
default across as a starting point.

## Writing a model

Everything - schema, validation, factory, relationships, behavior - is declared
in one `defineModel()` call. Migrations are derived from this; you do not write
the SQL.

```ts
// app/Models/Product.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Product',        // defaults to the file name
  table: 'products',      // defaults to lowercase plural of `name`
  primaryKey: 'id',       // default
  autoIncrement: true,    // default

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'products', routes: ['index', 'store', 'show', 'update', 'destroy'] },
    useSearch: { searchable: ['name'], filterable: ['status'] },
    observe: true,
  },

  belongsTo: ['Category'],
  hasMany: ['Review'],

  attributes: {
    name: {
      required: true,
      fillable: true,
      order: 1,
      validation: {
        rule: schema.string().min(3).max(100),
        message: { max: 'Name must have a maximum of 100 characters' },
      },
      factory: faker => faker.commerce.productName(),
    },
    status: {
      required: true,
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
      factory: faker => faker.helpers.arrayElement(['draft', 'published', 'archived']),
    },
  },
} as const)
```

`as const` is what the built-in models use - it narrows literal types so the
generated model types stay precise.

### Attribute fields

`validation.rule` is the only required key on an attribute.

| Field | Effect |
|---|---|
| `required` | Value required; emits a `NOT NULL` column |
| `nullable` | Explicit nullability override |
| `default` | Column default (`string \| number \| boolean \| Date`) |
| `unique` | Unique constraint |
| `type` | Force the column type instead of inferring from the rule |
| `order` | Column order in the table and in dashboard forms |
| `fillable` | Allow mass assignment |
| `guarded` | Block mass assignment |
| `hidden` | Exclude from JSON serialization (passwords, tokens) |
| `foreignKey` | Disable, infer, or configure the FK constraint |
| `factory` | `(faker) => value`, used by seeders and tests |
| `validation` | `{ rule, message? }` - `rule` from `schema`, `message` keyed by rule name |

### Traits

| Trait | What it adds |
|---|---|
| `useUuid` | UUID column alongside the primary key |
| `useTimestamps` (alias `timestampable`) | `created_at` / `updated_at`. On by default |
| `useSoftDeletes` (alias `softDeletable`) | `deleted_at` plus soft-delete query scopes |
| `useAuth` (alias `authenticatable`) | Auth columns; `{ usePasskey: true }` adds passkeys |
| `useApi` | Generates REST actions and routes: `{ uri, routes, middleware? }` |
| `useSearch` (alias `searchable`) | Search-engine indexing: `{ displayable, searchable, sortable, filterable }` |
| `useSocials` | OAuth identities, e.g. `['github']` |
| `useActivityLog` | Writes an `Activity` row per change |
| `observe` | Emits `{model}:created` / `:updated` / `:deleted` events |
| `billable` | Stripe methods (`checkout()`, `activeSubscription()`, ...) |
| `taggable` / `categorizable` / `commentable` / `likeable` | Pivot tables and their relation methods |

Also at the top level: `indexes: [{ name, columns, unique?, where? }]` for
composite and partial-unique indexes, and `dashboard: { highlight: true }` to
feature the model in the admin UI.

`useApi` is an API capability, not a dashboard-view generator. Its generated
routes are registered from the merged model registry. Framework defaults are
loaded first, then recursive `app/Models/` definitions override matching model
names. Protect non-public resources at the model:

```ts
useApi: {
  uri: 'mail-preferences',
  routes: ['index', 'store', 'show', 'update', 'destroy'],
  middleware: ['auth'],
}
```

Dashboard-specific endpoints may still use scoped Actions when their transport
shape, authorization boundary, or aggregation differs from generic CRUD. Do
not expose a sensitive model through unguarded generated routes just because a
separate dashboard endpoint is protected.

Generated store and update routes accept both spellings of every fillable
attribute and each foreign key implied by `belongsTo`. Declaring Product as a
belongs-to relation therefore accepts `productId` or `product_id` without
duplicating that relationship column as an attribute.

### Relationships

`hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasOneThrough`,
`hasManyThrough`, `morphOne`, `morphMany`, `morphTo`, `morphToMany`,
`morphedByMany`. Each takes an array of model names, or an object form when you
need to name the foreign key.

The object form is also where a `belongsTo` says what happens to its row when
the row it points at is deleted:

```ts
belongsTo: [
  { model: 'Repository', onDelete: 'cascade' },
  { model: 'User', foreignKey: 'author_id', onDelete: 'set null' },
],
```

`'cascade' | 'set null' | 'restrict' | 'no action'`, enforced by the database
on the foreign key. Left off, the default applies: the delete is refused while
a child still points at the row.

Worth declaring rather than deleting children in application code. The order
has to be right in every place that deletes, forever, and the place that misses
one leaves rows nothing can reach - while the database applies the rule to
deletes the application never made: a manual `DELETE`, a restore, another
service sharing the schema. Not for a polymorphic pair (`commentable_id`
beside `commentable_type`): those carry no foreign key at all, because a
constraint would name one table and reject every row pointing at another.

Use the named object form for a many-to-many relation that owns its pivot
schema. It keeps the relation accessor, migration, pivot defaults, timestamps,
and uniqueness in the model definition:

```ts
belongsToMany: {
  tags: {
    model: 'Tag',
    table: 'taggable_models',
    foreignKey: 'taggable_id',
    relatedKey: 'tag_id',
    pivot: {
      columns: {
        taggable_type: { default: 'posts' },
      },
      timestamps: true,
      uniques: [['tag_id', 'taggable_id', 'taggable_type']],
    },
  },
},
```

An instance then exposes the named relation directly:

```ts
const post = await Post.find(id)
await post.tags().sync(tagIds)
await post.tags().detach()
```

The legacy array form remains supported. Prefer the named form when the pivot
has custom keys, columns, defaults, timestamps, or uniqueness. Run
`buddy generate:migrations` after changing pivot metadata.

### Computed properties and scopes

```ts
get: {
  fullName: (model) => `${model.firstName} ${model.lastName}`,
},
set: {
  password: (value) => makeHash(value),
},
scopes: {
  published: (query) => query.where('status', 'published'),
},
```

## Workflow

```sh
buddy make:model Product        # scaffold app/Models/Product.ts
buddy generate:migrations       # diff models against the schema, emit SQL
# review the generated file in database/migrations/
buddy migrate                   # apply it
buddy migrate:fresh --seed      # dev only: drop, re-migrate, seed
```

Models resolve at runtime through `createModel()` from `bun-query-builder` -
there is no build step between editing a model and querying it. Only migrations
need generating.

## Seeding

Seed data is declared on the model, through the `useSeeder` trait plus the
per-attribute `factory` functions:

```ts
traits: {
  useSeeder: {
    count: 20,
    // Optional: pin specific rows over the generated ones. Keys use the
    // model's camelCase attribute names.
    fixtures: [
      { name: 'Flagship Widget', status: 'published' },
    ],
  },
},
```

`buddy seed` walks every model carrying the trait and fills its table from the
attribute factories. Nothing else is needed - no seeder files, no registration.

```bash
buddy seed                       # every model with a useSeeder trait
buddy seed --fresh               # truncate each table first
buddy seed --only Product,Review # just these models
buddy seed --except User         # everything but these
buddy seed --include-defaults    # framework built-ins too
```

A model with no `useSeeder` trait is never seeded. Auth and OAuth models are
skipped on a non-fresh database so re-seeding cannot invalidate live sessions -
pass `--allow-protected` to override.

## All 62 built-in models by category

### Users & Auth
- **User** — name, email, password | traits: useAuth(passkey), useUuid, useTimestamps, useSocials(github) | hasOne: Subscriber, Driver, Author | hasMany: PersonalAccessToken, Customer
- **Author** — name, email | belongsTo: User | hasMany: Post
- **Customer** — name, email, phone, totalSpent, lastOrder, status, avatar | belongsTo: User | hasMany: Order, GiftCard, Review, Payment
- **Driver** — name, phone, vehicleNumber, license, status | belongsTo: User | hasMany: DeliveryRoute
- **Subscriber** — email, status, source | belongsTo: User | hasMany: SubscriberEmail

### Content
- **Post** — title, content, poster, excerpt, views, publishedAt, status, isFeatured | belongsTo: Author | traits: categorizable, taggable, commentable | seeder: 20
- **Page** — similar to Post with taggable, categorizable
- **Comment** — author info, approval, content fields
- **Tag** — name(unique), slug(unique), description, postCount, color | seeder: 15
- **Category** — name, description, slug, imageUrl, isActive, parentCategoryId, displayOrder | hasMany: Product | seeder: 10

### Commerce (20+ models)
- **Product** — name(max100), description, price(min1), imageUrl, isAvailable, inventoryCount, preparationTime, allergens(JSON), nutritionalInfo(JSON) | belongsTo: Category, Manufacturer | hasMany: Review, ProductUnit, ProductVariant, LicenseKey, WaitlistProduct, Coupon | seeder: 10, dashboard: highlighted
- **ProductVariant** — SKU, options, pricing
- **ProductUnit** — unit-specific pricing
- **Cart** — status(active|abandoned|converted|expired), totalItems, subtotal, taxAmount, discountAmount, total, expiresAt, currency(USD), notes | hasMany: CartItem | belongsTo: Customer, Coupon
- **CartItem** — quantity(min1), unitPrice, totalPrice, taxRate, taxAmount, discountPercentage, productName, productSku | belongsTo: Cart
- **Order** — status, totalAmount, taxAmount, discountAmount, deliveryFee, tipAmount, orderType(DINE_IN|TAKEOUT|DELIVERY), deliveryAddress, specialInstructions | hasMany: OrderItem, Payment | belongsTo: Customer, Coupon | observe: true | seeder: 20
- **OrderItem** — quantity(min1), price(min0), specialInstructions | belongsTo: Order, Product
- **Coupon** — code(unique), discountType(fixed_amount|percentage), discountValue, minOrderAmount, usageLimit, usageCount, startDate, endDate | seeder: 15
- **GiftCard** — code(unique), initialBalance, currentBalance, currency, status, recipientEmail, isDigital, isReloadable, expiryDate | seeder: 20
- **Manufacturer** — manufacturer info
- **Review** — rating(1-5), title, content(max2000), isVerifiedPurchase, isApproved, isFeatured, helpfulVotes, unhelpfulVotes | belongsTo: Product, Customer | seeder: 50

### Shipping & Delivery
- **ShippingMethod**, **ShippingRate** (weightFrom, weightTo, rate), **ShippingZone**
- **DeliveryRoute** — driver, vehicle, stops, totalDistance | belongsTo: Driver
- **DigitalDelivery** — name, downloadLimit, expiryDays, automaticDelivery
- **LicenseKey** — key(XXXX-XXXX-XXXX-XXXX-XXXX), template, expiryDate, status

### Payments & Financial
- **Payment** — amount, method(creditCard|debitCard|paypal|...), status(pending|completed|failed|refunded), currency, transactionId(unique) | belongsTo: Order, Customer | seeder: 50
- **PaymentMethod**, **PaymentProduct**, **PaymentTransaction**
- **Subscription** — type, providerId, providerStatus, unitPrice
- **Transaction** — standard transaction tracking
- **TaxRate** — name, rate(0-100), type(VAT|GST|Sales Tax|Customs Duty), country, region, isDefault

### Engagement & Marketing
- **Notification** — type, channel, recipient, subject, body, status(pending|sent|delivered|failed|read) | belongsTo: User | seeder: 30
- **Campaign** — name, type(email|sms|push|social|multi-channel), status, audienceSize, openRate, clickRate, budget | seeder: 10
- **Activity** — type, description, subjectType, subjectId, causer, properties(JSON), ipAddress | belongsTo: User | seeder: 50
- **EmailList**, **SocialPost**, **LoyaltyPoint** (walletId, points, source, expiryDate), **LoyaltyReward**

### System
- **Job** — queue, payload, attempts, available_at, reserved_at | seeder: 15
- **FailedJob** — failed background jobs
- **Error** — type, message, stack, status, additionalInfo | seeder: 10
- **Log** — application logs
- **Request** — method, path, statusCode, durationMs, ipAddress, memoryUsage, userAgent, errorMessage | seeder: 50
- **Websocket** — connection tracking
- **PrintDevice** — name, location, terminal, lastPing, printCount, isActive
- **WaitlistProduct**, **WaitlistRestaurant** — waitlist tracking
- **Receipt** — receipt records

## CLI Commands
- `buddy make:model [name]` — scaffold a model in `app/Models/`
- `buddy publish:model [name]` — copy a built-in model into `app/Models/` to override it
- `buddy generate:migrations` — diff models against the schema and emit SQL
- `buddy migrate` / `buddy migrate:fresh --seed` — apply migrations
- `buddy make:migration [name]` — hand-write a migration instead
- `buddy make:factory [name]` — standalone factory
- `buddy seed` — seed every model carrying a `useSeeder` trait

## Gotchas
- **No code generation step for models.** `defineModel()` calls `createModel()`
  from bun-query-builder at runtime, so a model is queryable the moment you save
  it. Only migrations are generated.
- **Migrations come from models.** Change the model, run `buddy generate:migrations`,
  review the SQL, then `buddy migrate`. Editing a generated migration by hand
  will be overwritten by the next diff.
- **`commentable`, not `commentables`.** `define-model` only checks the singular
  key. The plural spelling used to type check while leaving the trait inert.
- **Seeding is model-declared.** `useSeeder` sets the count and fixtures; the
  per-attribute `factory` functions produce the values. There are no seeder
  files to write or register.
- **`hidden` is serialization, `guarded` is mass assignment.** They are different
  protections; a password wants both `hidden` and no `fillable`.
- **`validation.rule` is mandatory** on every attribute - it drives both request
  validation and the inferred column type.
- Dashboard-highlighted models (`dashboard: { highlight: true }`) appear
  prominently in the admin UI.
