---
name: stacks-orm
description: Use when working with the Stacks ORM — defining models with defineModel(), model relationships (hasOne, hasMany, belongsTo, belongsToMany, morphOne, hasManyThrough), attributes, traits, factories, computed properties, query building, transactions, or the 50+ built-in models. Covers @stacksjs/orm, storage/framework/orm/, and storage/framework/models/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks ORM

## Key Paths
- Core ORM package: `storage/framework/core/orm/src/`
- ORM implementation: `storage/framework/orm/`
- Model definitions: `storage/framework/models/` (50+ models)
- Application models: `app/Models/`
- Default model templates: `storage/framework/defaults/models/`
- ORM type globals: `storage/framework/types/orm-globals.d.ts`
- Attribute types: `storage/framework/types/attributes.ts` (240+ attributes)
- Model events: `storage/framework/types/events.ts`

## Source Files
```
orm/src/
├── define-model.ts     # defineModel() + buildEventHooks() + buildTraitMethods()
├── index.ts            # Re-exports orm/src + db + subquery + transaction + types
├── db.ts               # Database query builder bridge
├── subquery.ts         # Subquery support
├── transaction.ts      # transaction(), savepoint(), transactional()
├── model-types.ts      # ModelRow<T>, NewModelData<T>, UpdateModelData<T>
├── types.ts            # ORM type definitions
├── utils.ts            # modelTableName, getRelations, getFillableAttributes, etc.
├── builder.ts          # Query builder integration
├── generated/          # Auto-generated model types and table traits
│   ├── types.ts
│   ├── index.ts
│   └── table-traits.ts
└── traits/
    ├── index.ts         # Re-exports all trait creators
    ├── taggable.ts      # createTaggableMethods()
    ├── categorizable.ts # createCategorizableMethods()
    ├── commentable.ts   # createCommentableMethods()
    ├── billable.ts      # createBillableMethods()
    ├── likeable.ts      # createLikeableMethods()
    └── two-factor.ts    # createTwoFactorMethods()
```

## defineModel() API (define-model.ts)

Wraps bun-query-builder's `createModel()` with Stacks-specific enhancements:
- Event dispatching via `traits.observe` (emits `{model}:created`, `{model}:updated`, `{model}:deleted` via `@stacksjs/events`)
- Trait methods (billable, taggable, categorizable, commentable, likeable, 2FA)
- Raw definition access for generators (`getDefinition()`, `_isStacksModel`)

```typescript
import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'Product',
  table: 'products',
  primaryKey: 'id',        // default: 'id'
  autoIncrement: true,     // default: true

  traits: {
    useUuid: true,          // adds uuid column
    useTimestamps: true,    // adds created_at, updated_at
    useAuth: { usePasskey: true },  // adds auth columns + passkey support
    useSocials: ['github'], // social login providers
    useSearch: {            // search engine indexing
      displayable: ['name', 'email'],
      searchable: ['name', 'email'],
      sortable: ['name', 'created_at'],
      filterable: ['status']
    },
    useSeeder: { count: 10 },  // or just `true` (defaults to 10)
    useApi: {
      uri: 'products',
      routes: ['index', 'store', 'show', 'update', 'destroy']
    },
    categorizable: true,    // adds category relations via categorizable table
    taggable: true,         // adds tag relations via taggable table
    commentables: true,     // adds comment relations (NOTE: plural 's' in key)
    billable: true,         // adds Stripe integration methods
    likeable: true,         // or { table?: string, foreignKey?: string }
    observe: true,          // emit model events (true = all, or array: ['create','update','delete'])
  },

  // Relationships
  hasOne: ['Subscriber'],
  hasMany: ['Post', 'Order'],
  belongsTo: ['User', 'Category'],
  belongsToMany: ['Tag'],
  hasOneThrough: ['Profile'],
  morphOne: 'Image',       // or { model, morphName?, type?, id? }

  indexes: [
    { name: 'idx_email', columns: ['email'] },
    { name: 'idx_composite', columns: ['email', 'name'] }
  ],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      required: true,
      unique: false,
      validation: {
        rule: schema.string().maxLength(100),
        message: { maxLength: 'Name is too long' }
      },
      factory: (faker) => faker.lorem.word()
    },
    price: {
      fillable: true,
      required: true,
      validation: { rule: schema.number().min(1) },
      factory: (faker) => faker.datatype.number({ min: 100, max: 10000 })
    },
    status: {
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) }
    },
    password: {
      hidden: true,  // excluded from JSON serialization
      guarded: true, // not mass-assignable
    }
  },

  // Computed properties (accessors)
  get: {
    fullName: (attrs) => `${attrs.first_name} ${attrs.last_name}`,
    formattedPrice: (attrs) => `$${(attrs.price / 100).toFixed(2)}`
  },

  // Mutators (setters)
  set: {
    email: (attrs) => attrs.email?.toLowerCase()
  },

  // Model hooks (lifecycle callbacks)
  hooks: {
    afterCreate: (model) => { /* ... */ },
    afterUpdate: (model) => { /* ... */ },
    afterDelete: (model) => { /* ... */ },
  },

  dashboard: { highlight: true }  // highlight in admin dashboard
} as const)
```

### How defineModel() Works Internally
1. `buildEventHooks(definition)` -- if `traits.observe` is truthy, creates `afterCreate`/`afterUpdate`/`afterDelete` hooks that lazy-import `@stacksjs/events` and call `dispatch()`
2. Merges event hooks with any user-defined hooks
3. Calls `createModel(defWithHooks)` from bun-query-builder (provides typed query methods)
4. `buildTraitMethods(definition)` -- checks each trait flag and creates method objects
5. Returns `Object.assign(baseModel, traitMethods, definition)` + `getDefinition()` + `_isStacksModel`

## Transactions (transaction.ts)

```typescript
import { transaction, savepoint, transactional } from '@stacksjs/orm'

// Basic transaction -- auto-commit on success, auto-rollback on error
const result = await transaction(async (tx) => {
  await tx.insertInto('users').values({ name: 'John' }).execute()
  await tx.insertInto('profiles').values({ user_id: 1 }).execute()
  return 'success'
})

// With options
await transaction(callback, {
  retries: 3,
  isolation: 'serializable',  // 'read committed' | 'repeatable read' | 'serializable'
  readOnly: false,
  onRollback: (error) => console.error(error),
  afterRollback: () => { /* cleanup */ }
})

// Savepoints (nested transactions)
await transaction(async (tx) => {
  await tx.insertInto('users').values({ name: 'Bob' }).execute()
  await savepoint(async (sp) => {
    await sp.insertInto('logs').values({ action: 'created' }).execute()
    // If this fails, only this savepoint rolls back
  })
})

// Decorator-style -- wraps function to auto-run in transaction
const createUser = transactional(async (tx, name: string, email: string) => {
  const user = await tx.insertInto('users').values({ name }).returningAll().executeTakeFirst()
  await tx.insertInto('profiles').values({ user_id: user.id }).execute()
  return user
})
await createUser('Alice', 'alice@example.com') // auto-wrapped
```

Both `transaction()` and `savepoint()` delegate to `db.transaction()` and `db.savepoint()` from `@stacksjs/database`.

## Trait Methods (traits/)

### Taggable (when `traits.taggable: true`)
Uses `taggable` table with polymorphic `taggable_type` + `taggable_id` columns.
- `Model._taggable.tags(id: number): Promise<any[]>`
- `Model._taggable.tagCount(id: number): Promise<number>` -- uses `count(*)`
- `Model._taggable.addTag(id, { name, description? }): Promise<any>` -- auto-generates slug
- `Model._taggable.activeTags(id): Promise<any[]>` -- filters `is_active = true`
- `Model._taggable.inactiveTags(id): Promise<any[]>` -- filters `is_active = false`
- `Model._taggable.removeTag(id, tagId): Promise<void>`

### Categorizable (when `traits.categorizable: true`)
Uses `categorizable` + `categorizable_models` pivot table.
- `Model._categorizable.categories(id): Promise<any[]>` -- joins through pivot
- `Model._categorizable.categoryCount(id): Promise<number>`
- `Model._categorizable.addCategory(id, { name, description? }): Promise<any>` -- creates category if not exists, then links
- `Model._categorizable.activeCategories(id): Promise<any[]>`
- `Model._categorizable.inactiveCategories(id): Promise<any[]>`
- `Model._categorizable.removeCategory(id, categoryId): Promise<void>` -- removes pivot link

### Commentable (when `traits.commentables: true`)
Uses `comments` table with `commentables_id` + `commentables_type` columns.
- `Model._commentable.comments(id): Promise<any[]>`
- `Model._commentable.commentCount(id): Promise<number>`
- `Model._commentable.addComment(id, { title, body }): Promise<any>` -- status defaults to `'pending'`
- `Model._commentable.approvedComments(id): Promise<any[]>` -- status = `'approved'`
- `Model._commentable.pendingComments(id): Promise<any[]>` -- status = `'pending'`
- `Model._commentable.rejectedComments(id): Promise<any[]>` -- status = `'rejected'`

### Likeable (when `traits.likeable: true` or `{ table?, foreignKey? }`)
Table defaults to `{tableName}_likes`, FK defaults to `{singular}_id`.
- `Model._likeable.likes(id): Promise<any[]>`
- `Model._likeable.likeCount(id): Promise<number>`
- `Model._likeable.like(id, userId): Promise<any>`
- `Model._likeable.unlike(id, userId): Promise<void>`
- `Model._likeable.isLiked(id, userId): Promise<boolean>`

### Billable (when `traits.billable: true`) -- Stripe integration
All methods lazy-import `@stacksjs/payments`.
- `createStripeUser(model, options)`, `updateStripeUser(model, options)`, `deleteStripeUser(model)`
- `createOrGetStripeUser(model, options)`, `retrieveStripeUser(model)`
- `defaultPaymentMethod(model)`, `setDefaultPaymentMethod(model, pmId)`, `addPaymentMethod(model, paymentMethodId)`, `paymentMethods(model, cardType?)`
- `newSubscription(model, type, lookupKey, options)` -- returns `{ subscription, paymentIntent }`
- `updateSubscription(model, type, lookupKey, options)`, `cancelSubscription(model, providerId, options)`
- `activeSubscription(model)` -- queries `subscriptions` table for `provider_status = 'active'`, then retrieves from Stripe
- `checkout(model, priceIds[], options)` -- supports `enableTax`, `allowPromotions` options
- `createSetupIntent(model, options)`, `subscriptionHistory(model)`, `transactionHistory(model)`

### Two-Factor Auth (when `traits.useAuth.useTwoFactor: true`)
- `Model._twoFactor.generateTwoFactorForModel(model)` -- generates secret, calls `model.update()`
- `Model._twoFactor.verifyTwoFactorCode(model, code): Promise<boolean>`

## Auto-Generated System Fields
- `id` -- primary key (auto-increment)
- `created_at`, `updated_at` -- when `useTimestamps: true`
- `uuid` -- when `useUuid: true`
- `deleted_at` -- when soft deletes enabled
- `stripe_id` -- when `billable: true`
- `two_factor_secret`, `public_key` -- when `useAuth: { usePasskey: true }`

## Naming Conventions
- Model: PascalCase (`ProductVariant`)
- Table: snake_case plural (`product_variants`)
- Column: snake_case (`first_name`)
- Foreign key: `{singular_model}_id` (`user_id`)
- Pivot table: alphabetical sort of both table names (`category_product`)

## ORM Utility Types (model-types.ts)
```typescript
type Def<T> = T extends { getDefinition: () => infer D } ? D : never
type BelongsToForeignKeys<TDef>  // extracts { modelname_id: number } from belongsTo array
type ModelRow<T> = ModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>
type NewModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>
type UpdateModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>
```

## ORM Utility Functions (utils.ts)
- `modelTableName(model: Model | string): Promise<string>` -- uses `model.table` or converts `model.name` to snake_case plural
- `getModelName(model, modelPath): string` -- from definition or filename
- `getTableName(model, modelPath): TableNames` -- from definition or snake_case plural of name
- `getPivotTableName(modelA, modelB): string` -- alphabetical sort + join with `_`
- `getRelations(model, name): Promise<RelationConfig[]>` -- processes hasOne, hasMany, belongsTo, hasOneThrough, belongsToMany, morphOne
- `getHiddenAttributes(attrs): string[]` -- filters for `hidden: true`
- `getGuardedAttributes(model): string[]` -- filters for `guarded: true`, returns snake_case
- `getFillableAttributes(model, relations): string[]` -- filters for `fillable: true`, adds FK columns, stripe_id, uuid, etc.
- `extractFields(model, file): Promise<ModelElement[]>` -- parses model file for field metadata
- `findCoreModel(name): string` -- searches `storage/framework/defaults/models/` recursively
- `findUserModel(name): string` -- searches `app/Models/`
- `fetchOtherModelRelations(modelName?): Promise<RelationConfig[]>` -- scans all models for relations pointing to this model
- `formatDate(date): string` -- ISO format `YYYY-MM-DD HH:MM:SS`

## Relationship Processing (utils.ts)
Each relationship type is processed into a `RelationConfig` object:
- **hasOne / hasMany**: FK = `{parent_snake}_id`, model key = `{related_snake}_id`
- **belongsTo**: FK is empty string (set on the owning model's side), supports custom `foreignKey`
- **belongsToMany**: auto-creates pivot table name via `getPivotTableName()`, supports `pivotTable`, `firstForeignKey`, `secondForeignKey` overrides
- **hasOneThrough**: includes `throughModel` and `throughForeignKey`
- **morphOne**: uses `{modelName}able` pattern, generates `_type` and `_id` columns

## Model Events (when `traits.observe: true`)
`observe: true` emits all three events. `observe: ['create', 'update']` emits only those.
- `'{modelname}:created'` -- via `afterCreate` hook, lazy-imports `@stacksjs/events`
- `'{modelname}:updated'` -- via `afterUpdate` hook
- `'{modelname}:deleted'` -- via `afterDelete` hook

If `@stacksjs/events` is not available (browser, tests), errors are caught and silently ignored.

## Stub Types in index.ts
The ORM exports stub types for commonly used models to keep typecheck green before code generation:
- `UserModel`, `NewUser`, `User` (class stub with static `where`, `find`, `create`, `all`)
- `Job`, `FailedJob` (query stubs)
- `PaymentMethod` (CRUD stubs)
- `CategorizableTable`, `CategorizableModelsTable`, `CommentablesTable`, `TaggableTable`

## All 50+ Framework Models
Content: Author, Page, Post, Comment, Tag, Category
Users: User, Customer, Driver, Subscriber, SubscriberEmail
Commerce: Product, ProductVariant, ProductUnit, Cart, CartItem, Order, OrderItem, Coupon, GiftCard, Manufacturer, Review, LicenseKey, DigitalDelivery, WaitlistProduct, WaitlistRestaurant
Payments: Payment, PaymentMethod, PaymentProduct, PaymentTransaction, Subscription, Transaction, Receipt
Shipping: ShippingMethod, ShippingRate, ShippingZone, DeliveryRoute
Loyalty: LoyaltyPoint, LoyaltyReward, TaxRate
System: Job, FailedJob, Error, Log, Notification, Activity, Request, Websocket, PrintDevice
Marketing: Campaign, EmailList, SocialPost

## CLI Commands
- `buddy make:migration` -- create migration for model changes
- `buddy generate:migrations` -- generate migrations from model diffs
- `buddy migrate` -- run pending migrations

## Gotchas
- Models work directly via the dynamic ORM — no code generation step needed
- `defineModel()` calls `createModel()` from bun-query-builder at runtime, providing all typed query methods immediately
- Two ORM locations: `storage/framework/core/orm/` (package) and `storage/framework/orm/` (implementation)
- Factories use `@stacksjs/faker` -- each attribute can have a `factory` function
- The `hidden` attribute flag excludes fields from JSON serialization (e.g., passwords)
- The `guarded` flag prevents mass assignment
- The `fillable` flag explicitly allows mass assignment
- Pivot tables for belongsToMany are auto-created using alphabetical naming of both table names
- Model events are only emitted when `observe: true` (or array) trait is set
- The trait key for commentable is `commentables` (with 's'), not `commentable`
- Trait methods are accessed via underscore-prefixed properties: `_taggable`, `_categorizable`, `_commentable`, `_billable`, `_likeable`, `_twoFactor`
- The `useAuth.useTwoFactor` check (not `usePasskey`) determines if two-factor methods are added
- `defineModel()` calls `createModel()` from bun-query-builder which returns the typed query builder interface at runtime
- Model file loading uses `findUserModel()` (app/Models/) with fallback to `findCoreModel()` (storage/framework/defaults/models/)
