// Force `@stacksjs/validation` to evaluate fully before any user model file
// runs `import { schema } from '@stacksjs/validation'`. Without this priming
// import, the auto-imports barrel triggers user models concurrently, and
// later models in the barrel see `schema` in TDZ (the validator hasn't
// reached its `export const schema = v` line yet because evaluation jumped
// into the user model graph first). Pulling it in here at the top of every
// `@stacksjs/orm` consumer's evaluation guarantees schema is bound first.
import '@stacksjs/validation'

export * from './utils/prunable'
export type { PrunableOptions } from './utils/prunable'
export {
  collectEncryptedAttributes,
  decryptValue,
  encryptValue,
  isEncrypted,
} from './utils/encrypted'
// Audit trait public API: setAuditUser is the queue/cron escape hatch for
// attributing audit rows to a user when there's no current HTTP request.
export { setAuditUser, createAuditMethods } from './traits/audit'
export type { AuditHelpers } from './traits/audit'
// Re-export soft-delete option types so user code can `satisfies SoftDeleteOptions`.
export type { SoftDeleteOptions, SoftDeleteHelpers } from './traits/soft-deletes'
export * from './batch-loader'
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './model-types'
export * from './types'
export * from './utils'
export * from './define-model'
// Canonical paginator shapes + adapters (stacksjs/stacks#1905 P1).
export {
  isCursorPaginator,
  isPaginator,
  isSimplePaginator,
  toCursorPaginator,
  toPaginator,
  toSimplePaginator,
} from './paginator'
export type { CursorPaginator, Paginator, SimplePaginator } from './paginator'
// Request-aware pagination helpers (stacksjs/stacks#1906 P2 + #1907 P3).
export {
  enrichPaginatorUrls,
  parseCursor,
  resolveCursorArgs,
  resolvePageArgs,
} from './paginator-request'
export type { ResolvedPageArgs } from './paginator-request'

// Auto-configure the ORM database connection from project config.
// This ensures model queries work without manual configureOrm() calls.
import { configureOrm } from '@stacksjs/query-builder'

function autoConfigureOrm(): void {
  try {
    const dbPath = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
    const dialect = process.env.DB_CONNECTION || 'sqlite'

    if (dialect === 'sqlite') {
      configureOrm({ database: dbPath })
    }
  }
  catch {
    // Config not available yet — will be configured on first query via @stacksjs/database
  }
}

autoConfigureOrm()

// `@stacksjs/auth` (and other framework packages) statically imports
// `User from '@stacksjs/orm'`, so we have to provide it here. Loading via
// `await import` instead of `export *` keeps the rest of the model graph
// out of orm's evaluation graph — only User is pulled in, and only after
// orm has finished its own static-import phase. The await pauses orm's
// module evaluation just long enough to bind User without re-introducing
// the auto-imports → schema-TDZ cycle that re-exporting the whole barrel
// would cause.
//
// `loadUserlandModel` resolves the project root using `@stacksjs/path`,
// not a relative `../../../../../` path. The relative depth differs
// between the two layouts this package can run from:
//   - workspace: `storage/framework/core/orm/src/index.ts` → 5 ups
//   - installed: `node_modules/@stacksjs/orm/src/index.ts` → 4 ups
// projectPath() handles both because it walks up looking for the project
// root (package.json with no parent), so the same code works regardless.
async function loadUserlandModel(modelName: string, subdirs: string[] = ['']): Promise<any> {
  const { path } = await import('@stacksjs/path')
  // 1) User override at app/Models/<Name>.ts (always wins, no subdir search
  //    on the user side — projects flatten their model directory).
  const userPath = path.userModelsPath(`${modelName}.ts`)
  try {
    if (await Bun.file(userPath).exists()) {
      return (await import(userPath)).default
    }
  }
  catch (err) {
    // Pre-fix this was a bare `catch {}` — a typo'd user model silently
    // fell through to the framework default, so the dev's customizations
    // appeared to "not be applied" with no log line indicating why.
    // Surface the actual import error so they can fix it.
    console.error(`[orm] Failed to import userland model ${modelName} from ${userPath} — falling back to framework default. Reason:`, err)
  }
  // 2) Framework default at storage/framework/defaults/app/Models/<Name>.ts
  //    Defaults are organised in subdirectories (commerce/, Content/,
  //    realtime/) so each model is searched in the relevant subdir first
  //    then the root — `subdirs` is the priority list of folders to try.
  for (const sub of subdirs) {
    const prefix = sub ? `${sub}/` : ''
    const defaultPath = path.frameworkPath(`defaults/app/Models/${prefix}${modelName}.ts`)
    try {
      if (await Bun.file(defaultPath).exists()) {
        return (await import(defaultPath)).default
      }
    }
    catch (err) {
      // Same fix as above for the framework-default branch — a broken
      // default shouldn't be invisible.
      console.error(`[orm] Failed to import framework default model ${modelName} from ${defaultPath} — trying next subdir. Reason:`, err)
    }
  }
  return null
}

// =============================================================================
// Lazy model exports.
//
// The eager `export const User = await loadUserlandModel('User')` pattern that
// used to live here deadlocked on the ESM cycle between this module and the
// user's model files: `app/Models/User.ts` statically imports `{ defineModel }`
// from `@stacksjs/orm` (this file), and Bun's dynamic `await import(userPath)`
// from inside orm's evaluation waits for User.ts to finish — which can't,
// because it's transitively waiting on orm to finish.
//
// Pre-fix this only "worked" because the trait files threw TDZ during User.ts
// evaluation, breaking the cycle by failing fast. Once the trait TDZ was fixed
// the cycle had to actually resolve, and it couldn't.
//
// New pattern: schedule the model loads as a microtask that runs AFTER orm's
// own static-import graph finishes. By the time the microtask fires, all
// participating modules (database, validation, define-model, the traits) are
// fully bound, and the dynamic `await import(userPath)` no longer cycles back
// into a half-loaded module. Each export is a Proxy that forwards to the
// loaded model once available; per-request code (HTTP actions, jobs) is
// always called long after the microtask queue has drained, so `User.where(...)`
// at request time works transparently. Code that touches the exports at
// MODULE LOAD time (e.g. a top-level `const adminCount = await User.count()`
// in someone's startup script) should `await ormReady` first.
// =============================================================================

const _loaded: Record<string, any> = {}

let _readyResolve: () => void = () => {}
/**
 * Resolves once all framework-default models have been loaded into the
 * lazy-export proxies. Server bootstrap code that wants to ensure model
 * exports are populated before serving the first request should
 * `await ormReady` early. Per-request code doesn't need to — by the
 * time any HTTP handler runs, the microtask queue has long drained.
 */
export const ormReady: Promise<void> = new Promise<void>((resolve) => { _readyResolve = resolve })

/**
 * Returns a Proxy that lazily forwards every property access to the
 * loaded model in `_loaded[name]`. Returns `undefined` before the
 * deferred load completes — callers that need the load to finish
 * first should `await ormReady`.
 */
function lazyModel(name: string): any {
  // The Proxy target is a function so the proxy itself is callable
  // (in case any consumer treats a model as a constructor).
  return new Proxy(function _modelStub() {} as any, {
    get(_target, prop) {
      // Thenable guard — without it, `await User` would call
      // `User.then`, which we'd forward to the underlying (often
      // function-like bun-query-builder) value, causing JS to treat
      // this Proxy as a Promise and infinite-loop on resolution.
      if (prop === 'then')
        return undefined
      const m = _loaded[name]
      if (m == null)
        return undefined
      const value = (m as any)[prop]
      // Bind methods to the underlying model so `this` is correct
      // when the Proxy is the receiver.
      return typeof value === 'function' ? value.bind(m) : value
    },
    set(_target, prop, value) {
      const m = _loaded[name]
      if (m == null)
        return false
      ;(m as any)[prop] = value
      return true
    },
    has(_target, prop) {
      const m = _loaded[name]
      return m == null ? false : prop in (m as any)
    },
    apply(_target, thisArg, args) {
      const m = _loaded[name]
      if (m == null || typeof m !== 'function')
        return undefined
      return (m as Function).apply(thisArg, args)
    },
  })
}

export const User: any = lazyModel('User')

// Queue framework models. The CLI commands `buddy queue:status`,
// `queue:failed`, `queue:flush`, `queue:inspect`, `queue:monitor`,
// `queue:clear` import them as `import { Job, FailedJob } from
// '@stacksjs/orm'`. Prefer the userland publication
// (`app/Models/Job.ts`, dropped in by `buddy publish:model Job`) so
// projects that customize the queue model see their version.
//
// Gated on the 'queue' feature flag — projects that don't run a queue
// (most marketing sites, plain CMS apps) leave it off and skip the
// defineModel pipeline for these two entirely. The lazyModel proxy
// returns `undefined` for unloaded models, and the CLI queue commands
// can check `await ormReady; if (!Job) throw …` to surface a clear
// "run ./buddy queue:install" error.
export const Job: any = lazyModel('Job')
export const FailedJob: any = lazyModel('FailedJob')

// ---------------------------------------------------------------------------
// Auto-load every other framework model. Each row is `[name, subdirs, feature]`:
//   - `name`     : the model class, used as the file basename and the export
//   - `subdirs`  : where to look under `storage/framework/defaults/app/Models/`
//   - `feature`  : which feature bundle owns this model — only loaded when
//                  that bundle's `config/<feature>.ts` has `enabled: true`.
//                  Apps that haven't run `./buddy commerce:install` skip
//                  every entry tagged 'commerce' entirely (no migrations
//                  needed, no defineModel pipeline, no boot cost).
//
// The root namespace is searched first (so a flattened user override wins),
// then the subdir for the framework default. Loaded sequentially so the
// schema-TDZ cycle the original `User`-only export was guarding against
// stays neutralised.
// ---------------------------------------------------------------------------
const FRAMEWORK_MODEL_MANIFEST: Array<[name: string, subdirs: string[], feature: string]> = [
  // Auth
  ['Team', [''], 'auth'],
  ['Subscriber', [''], 'auth'],
  ['SubscriberEmail', [''], 'auth'],
  ['Subscription', [''], 'auth'],

  // CMS (Content subdir on disk uses the capital C)
  ['Post', ['Content'], 'cms'],
  ['Page', ['Content'], 'cms'],
  ['Author', ['Content'], 'cms'],
  ['Comment', [''], 'cms'],
  ['Tag', [''], 'cms'],

  // Dashboard (admin SPA + monitoring dashboards)
  ['Activity', [''], 'dashboard'],
  ['Deployment', [''], 'dashboard'],
  ['Release', [''], 'dashboard'],
  ['Notification', [''], 'dashboard'],
  ['Log', [''], 'dashboard'],
  ['Request', [''], 'dashboard'],

  // Monitoring (Error model can be used standalone without the rest of dashboard)
  ['Error', [''], 'monitoring'],

  // Realtime (websocket broadcaster)
  ['Websocket', ['realtime'], 'realtime'],

  // Marketing (email lists, campaigns, social posts)
  ['Campaign', [''], 'marketing'],
  ['CampaignSend', [''], 'marketing'],
  ['EmailList', [''], 'marketing'],
  ['EmailListSubscriber', [''], 'marketing'],
  ['SocialPost', [''], 'marketing'],

  // Payments (top-level — used by commerce checkout and by standalone billing)
  ['PaymentMethod', [''], 'commerce'],
  ['PaymentProduct', [''], 'commerce'],
  ['PaymentTransaction', [''], 'commerce'],

  // Commerce
  ['Order', ['commerce'], 'commerce'],
  ['OrderItem', ['commerce'], 'commerce'],
  ['Cart', ['commerce'], 'commerce'],
  ['CartItem', ['commerce'], 'commerce'],
  ['Customer', ['commerce'], 'commerce'],
  ['Product', ['commerce'], 'commerce'],
  ['ProductVariant', ['commerce'], 'commerce'],
  ['ProductUnit', ['commerce'], 'commerce'],
  ['Manufacturer', ['commerce'], 'commerce'],
  ['Category', ['commerce'], 'commerce'],
  ['Coupon', ['commerce'], 'commerce'],
  ['GiftCard', ['commerce'], 'commerce'],
  ['LicenseKey', ['commerce'], 'commerce'],
  ['Review', ['commerce'], 'commerce'],
  ['Receipt', ['commerce'], 'commerce'],
  ['PrintDevice', ['commerce'], 'commerce'],
  ['ShippingMethod', ['commerce'], 'commerce'],
  ['ShippingRate', ['commerce'], 'commerce'],
  ['ShippingZone', ['commerce'], 'commerce'],
  ['DeliveryRoute', ['commerce'], 'commerce'],
  ['DigitalDelivery', ['commerce'], 'commerce'],
  ['Driver', ['commerce'], 'commerce'],
  ['TaxRate', ['commerce'], 'commerce'],
  ['WaitlistProduct', ['commerce'], 'commerce'],
  ['WaitlistRestaurant', ['commerce'], 'commerce'],
  ['LoyaltyPoint', ['commerce'], 'commerce'],
  ['LoyaltyReward', ['commerce'], 'commerce'],
  ['Payment', ['commerce'], 'commerce'],
  ['Transaction', ['commerce'], 'commerce'],
]

// Schedule deferred loads. The microtask runs AFTER orm's own static-import
// graph finishes — by which point @stacksjs/config (where `feature()` lives)
// AND every user model file's static `import { defineModel } from
// '@stacksjs/orm'` have resolved cleanly. No cycle deadlock, no TDZ flood,
// no eager-pre-init pipeline.
queueMicrotask(async () => {
  try {
    const { feature } = await import('@stacksjs/config')

    // User always loads (gated on 'core' which is implicitly true). Done
    // first because so many framework packages statically import User.
    const userModel = await loadUserlandModel('User')
    if (userModel) _loaded.User = userModel

    if (feature('queue')) {
      const job = await loadUserlandModel('Job')
      if (job) _loaded.Job = job
      const failedJob = await loadUserlandModel('FailedJob')
      if (failedJob) _loaded.FailedJob = failedJob
    }

    for (const [name, subdirs, featureFlag] of FRAMEWORK_MODEL_MANIFEST) {
      if (!feature(featureFlag)) continue
      // eslint-disable-next-line no-await-in-loop
      const M = await loadUserlandModel(name, subdirs)
      if (M) _loaded[name] = M
    }
  }
  catch (err) {
    // A failed deferred load shouldn't hang `ormReady` forever — surface
    // the error and resolve anyway so any waiters proceed and can report
    // the missing model in their own context.
    console.error('[orm] deferred model load failed:', err)
  }
  finally {
    _readyResolve()
  }
})

export const Activity: any = lazyModel('Activity')
export const Author: any = lazyModel('Author')
export const Campaign: any = lazyModel('Campaign')
export const Cart: any = lazyModel('Cart')
export const CartItem: any = lazyModel('CartItem')
export const Category: any = lazyModel('Category')
export const Comment: any = lazyModel('Comment')
export const Coupon: any = lazyModel('Coupon')
export const Customer: any = lazyModel('Customer')
export const DeliveryRoute: any = lazyModel('DeliveryRoute')
export const Deployment: any = lazyModel('Deployment')
export const DigitalDelivery: any = lazyModel('DigitalDelivery')
export const Driver: any = lazyModel('Driver')
export const CampaignSend: any = lazyModel('CampaignSend')
export const EmailList: any = lazyModel('EmailList')
export const EmailListSubscriber: any = lazyModel('EmailListSubscriber')
export const ErrorModel: any = lazyModel('Error')
export const GiftCard: any = lazyModel('GiftCard')
export const LicenseKey: any = lazyModel('LicenseKey')
export const Log: any = lazyModel('Log')
export const LoyaltyPoint: any = lazyModel('LoyaltyPoint')
export const LoyaltyReward: any = lazyModel('LoyaltyReward')
export const Manufacturer: any = lazyModel('Manufacturer')
export const Notification: any = lazyModel('Notification')
export const Order: any = lazyModel('Order')
export const OrderItem: any = lazyModel('OrderItem')
export const Page: any = lazyModel('Page')
export const Payment: any = lazyModel('Payment')
export const PaymentMethod: any = lazyModel('PaymentMethod')
export const PaymentProduct: any = lazyModel('PaymentProduct')
export const PaymentTransaction: any = lazyModel('PaymentTransaction')
export const Post: any = lazyModel('Post')
export const PrintDevice: any = lazyModel('PrintDevice')
export const Product: any = lazyModel('Product')
export const ProductUnit: any = lazyModel('ProductUnit')
export const ProductVariant: any = lazyModel('ProductVariant')
export const Receipt: any = lazyModel('Receipt')
export const Release: any = lazyModel('Release')
export const Request: any = lazyModel('Request')
export const Review: any = lazyModel('Review')
export const ShippingMethod: any = lazyModel('ShippingMethod')
export const ShippingRate: any = lazyModel('ShippingRate')
export const ShippingZone: any = lazyModel('ShippingZone')
export const SocialPost: any = lazyModel('SocialPost')
export const Subscriber: any = lazyModel('Subscriber')
export const SubscriberEmail: any = lazyModel('SubscriberEmail')
export const Subscription: any = lazyModel('Subscription')
export const Tag: any = lazyModel('Tag')
export const TaxRate: any = lazyModel('TaxRate')
export const Team: any = lazyModel('Team')
export const Transaction: any = lazyModel('Transaction')
export const WaitlistProduct: any = lazyModel('WaitlistProduct')
export const WaitlistRestaurant: any = lazyModel('WaitlistRestaurant')
export const Websocket: any = lazyModel('Websocket')

// Inject every model Proxy onto globalThis so dashboard `<script server>`
// blocks can reference them as bare names (e.g. `await Order.all()`) without
// having to import. The STX engine evaluates server scripts inside an
// AsyncFunction wrapper, which inherits from globalThis — assigning here
// makes the names visible to every page render. The values are Proxies that
// forward to `_loaded[name]` at access time; until the deferred microtask
// populates `_loaded`, every method access returns undefined. By the time
// any stx page render fires (request time), the microtask queue has long
// drained, so `await Order.all()` resolves transparently.
const _allExports: Record<string, any> = {
  User, Job, FailedJob,
  Activity, Author, Campaign, CampaignSend, Cart, CartItem, Category,
  Comment, Coupon, Customer, DeliveryRoute, Deployment, DigitalDelivery,
  Driver, EmailList, EmailListSubscriber, ErrorModel, GiftCard, LicenseKey,
  Log, LoyaltyPoint, LoyaltyReward, Manufacturer, Notification, Order,
  OrderItem, Page, Payment, PaymentMethod, PaymentProduct, PaymentTransaction,
  Post, PrintDevice, Product, ProductUnit, ProductVariant, Receipt, Release,
  Request, Review, ShippingMethod, ShippingRate, ShippingZone, SocialPost,
  Subscriber, SubscriberEmail, Subscription, Tag, TaxRate, Team, Transaction,
  WaitlistProduct, WaitlistRestaurant, Websocket,
}
const g = globalThis as Record<string, any>
for (const [name, M] of Object.entries(_allExports)) {
  if (M && g[name] === undefined) g[name] = M
}

// Tiny safety helpers that pair with the model globals. They live on
// globalThis too so a page can do `const orders = await safeAll(Order)`
// or `const name = safeGet(user, 'name')` without an import. Assigned
// only if absent so a userland module can override them.
async function _safeAll(M: any): Promise<any[]> {
  if (!M) return []
  try {
    if (typeof M.all === 'function') {
      const rows = await M.all()
      return Array.isArray(rows) ? rows : []
    }
    if (typeof M.get === 'function') {
      const rows = await M.get()
      return Array.isArray(rows) ? rows : []
    }
  }
  catch { /* table missing or schema mismatch — render empty */ }
  return []
}
function _safeGet(row: any, key: string, fallback: any = ''): any {
  if (!row) return fallback
  try {
    if (typeof row.get === 'function') {
      const v = row.get(key)
      if (v !== undefined && v !== null) return v
    }
  }
  catch { /* fall through to direct property access */ }
  const direct = row?.[key]
  return direct !== undefined && direct !== null ? direct : fallback
}

if (g.safeAll === undefined) g.safeAll = _safeAll
if (g.safeGet === undefined) g.safeGet = _safeGet

// Re-export type utilities from bun-query-builder so consumers can infer
// model types directly from defineModel() definitions
export type {
  InferAttributes,
  InferPrimaryKey,
  InferRelationNames,
  InferTableName,
  ModelDefinition,
} from '@stacksjs/query-builder'

// `InferFillableAttributes`, `InferNumericColumns`, `InferColumnNames`,
// `ModelRow`, `ModelRowLoose`, `ModelCreateData`, `ModelCreateDataLoose`,
// `NewModelData`, and `UpdateModelData` are exported via
// `export * from './model-types'` above. They're real conditional types
// over `Def<T>` (the model-definition extracted from a `defineModel()`
// return value) — see `model-types.ts` for the implementations.
// Previously this file re-declared them as `any` stubs which shadowed
// the typed versions; stacksjs/stacks#1863 (T-1) restored the real types.

// ---------------------------------------------------------------------------
// Blessed framework-default model row types.
//
// Most consumer code reaches for `ModelRow<typeof User>` /
// `NewModelData<typeof User>` directly — those are the preferred,
// project-aware patterns and they automatically reflect any
// customisation made to `app/Models/User.ts`.
//
// `UserModel` / `NewUser` are exported as "blessed" aliases for the
// framework's default User model so legacy framework code (~220 call
// sites across the cms / commerce / payments / dashboard packages)
// keeps typechecking against a real shape rather than `any`. Project
// code that ships its own User model with extra columns should
// augment via TypeScript module augmentation:
//
// @example
// // anywhere in your project (e.g. app/types.d.ts)
// declare module '@stacksjs/orm' {
//   interface UserModel extends ModelRow<typeof MyUser> {}
//   interface NewUser extends NewModelData<typeof MyUser> {}
// }
//
// Each is declared as an `interface` (not a `type`) so module
// augmentation can extend it from project code.
// ---------------------------------------------------------------------------

/**
 * Framework-default User row shape. Matches the attributes declared on
 * `storage/framework/defaults/app/Models/User.ts` plus the system
 * fields contributed by `useUuid` / `useTimestamps` / `useAuth` traits.
 *
 * For project-specific narrowing, prefer `ModelRow<typeof User>` so
 * any added attributes flow through automatically.
 */
export interface UserModel {
  id: number
  uuid: string
  name: string
  email: string
  password: string
  avatar?: string | null
  email_verified_at?: string | null
  two_factor_secret?: string | null
  public_key?: string | null
  created_at: string
  updated_at: string | null
  [key: string]: unknown
}

/**
 * Framework-default insertable User shape — fillable attributes from
 * the default User model, all optional (DB-side defaults can fill in
 * the rest). For project-specific narrowing, prefer
 * `NewModelData<typeof User>`.
 */
export interface NewUser {
  name?: string
  email?: string
  password?: string
  avatar?: string | null
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Polymorphic trait table types — used by @stacksjs/cms and database drivers.
// These describe trait-managed tables (categorizable, commentable, taggable)
// that don't have standalone model definitions. Once the trait system in
// bun-query-builder supports schema inference, these can be removed.
// ---------------------------------------------------------------------------

/** Row type for the polymorphic categories table (categorizable trait). */
export interface CategorizableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  categorizable_type: string
  created_at?: string
  updated_at?: string
}

/** Row type for the category-model pivot table (categorizable trait). */
export interface CategorizableModelsTable {
  id?: number
  category_id: number
  categorizable_type: string
  categorizable_id: number
  created_at?: string
  updated_at?: string
}

/** Row type for the polymorphic comments table (commentable trait). */
export interface CommentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}

/** Row type for the polymorphic tags table (taggable trait). */
export interface TaggableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  taggable_type: string
  created_at?: string
  updated_at?: string
}
