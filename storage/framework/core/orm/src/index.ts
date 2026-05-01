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
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './model-types'
export * from './types'
export * from './utils'
export * from './define-model'

// Auto-configure the ORM database connection from project config.
// This ensures model queries work without manual configureOrm() calls.
import { configureOrm } from 'bun-query-builder'

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
  catch { /* fall through to framework default */ }
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
    catch { /* try next subdir */ }
  }
  return null
}

export const User = await loadUserlandModel('User')

// Same lazy-export pattern for the two queue framework models. The CLI
// commands `buddy queue:status`, `queue:failed`, `queue:flush`,
// `queue:inspect`, `queue:monitor`, `queue:clear` import them as
// `import { Job, FailedJob } from '@stacksjs/orm'`. Prefer the userland
// publication (`app/Models/Job.ts`, dropped in by `buddy publish:model
// Job`) so projects that customize the queue model — renamed columns,
// extra observers, custom traits — see their version.
export const Job = await loadUserlandModel('Job')
export const FailedJob = await loadUserlandModel('FailedJob')

// ---------------------------------------------------------------------------
// Auto-load every other framework model. Each name is paired with the
// subdirectory it lives in under `storage/framework/defaults/app/Models/`.
// The root namespace is searched first (so a flattened user override wins),
// then the subdir for the framework default. Loaded sequentially so the
// schema-TDZ cycle the original `User`-only export was guarding against
// stays neutralised.
// ---------------------------------------------------------------------------
const FRAMEWORK_MODEL_MANIFEST: Array<[name: string, subdirs: string[]]> = [
  // Auth / core
  ['Team', ['']],
  ['Subscriber', ['']],
  ['SubscriberEmail', ['']],
  ['Subscription', ['']],

  // Content (note: capital "Content/" subdir on disk)
  ['Post', ['Content']],
  ['Page', ['Content']],
  ['Author', ['Content']],
  ['Comment', ['']],
  ['Tag', ['']],

  // App / operations
  ['Activity', ['']],
  ['Deployment', ['']],
  ['Release', ['']],
  ['Notification', ['']],
  ['Log', ['']],
  ['Request', ['']],
  ['Error', ['']],
  ['Websocket', ['realtime']],

  // Marketing
  ['Campaign', ['']],
  ['EmailList', ['']],
  ['SocialPost', ['']],

  // Payments (top-level)
  ['PaymentMethod', ['']],
  ['PaymentProduct', ['']],
  ['PaymentTransaction', ['']],

  // Commerce
  ['Order', ['commerce']],
  ['OrderItem', ['commerce']],
  ['Cart', ['commerce']],
  ['CartItem', ['commerce']],
  ['Customer', ['commerce']],
  ['Product', ['commerce']],
  ['ProductVariant', ['commerce']],
  ['ProductUnit', ['commerce']],
  ['Manufacturer', ['commerce']],
  ['Category', ['commerce']],
  ['Coupon', ['commerce']],
  ['GiftCard', ['commerce']],
  ['LicenseKey', ['commerce']],
  ['Review', ['commerce']],
  ['Receipt', ['commerce']],
  ['PrintDevice', ['commerce']],
  ['ShippingMethod', ['commerce']],
  ['ShippingRate', ['commerce']],
  ['ShippingZone', ['commerce']],
  ['DeliveryRoute', ['commerce']],
  ['DigitalDelivery', ['commerce']],
  ['Driver', ['commerce']],
  ['TaxRate', ['commerce']],
  ['WaitlistProduct', ['commerce']],
  ['WaitlistRestaurant', ['commerce']],
  ['LoyaltyPoint', ['commerce']],
  ['LoyaltyReward', ['commerce']],
  ['Payment', ['commerce']],
  ['Transaction', ['commerce']],
]

const _autoLoaded: Record<string, any> = {}
for (const [name, subdirs] of FRAMEWORK_MODEL_MANIFEST) {
  // eslint-disable-next-line no-await-in-loop
  const M = await loadUserlandModel(name, subdirs)
  if (M) _autoLoaded[name] = M
}

export const Activity = _autoLoaded.Activity
export const Author = _autoLoaded.Author
export const Campaign = _autoLoaded.Campaign
export const Cart = _autoLoaded.Cart
export const CartItem = _autoLoaded.CartItem
export const Category = _autoLoaded.Category
export const Comment = _autoLoaded.Comment
export const Coupon = _autoLoaded.Coupon
export const Customer = _autoLoaded.Customer
export const DeliveryRoute = _autoLoaded.DeliveryRoute
export const Deployment = _autoLoaded.Deployment
export const DigitalDelivery = _autoLoaded.DigitalDelivery
export const Driver = _autoLoaded.Driver
export const EmailList = _autoLoaded.EmailList
export const ErrorModel = _autoLoaded.Error
export const GiftCard = _autoLoaded.GiftCard
export const LicenseKey = _autoLoaded.LicenseKey
export const Log = _autoLoaded.Log
export const LoyaltyPoint = _autoLoaded.LoyaltyPoint
export const LoyaltyReward = _autoLoaded.LoyaltyReward
export const Manufacturer = _autoLoaded.Manufacturer
export const Notification = _autoLoaded.Notification
export const Order = _autoLoaded.Order
export const OrderItem = _autoLoaded.OrderItem
export const Page = _autoLoaded.Page
export const Payment = _autoLoaded.Payment
export const PaymentMethod = _autoLoaded.PaymentMethod
export const PaymentProduct = _autoLoaded.PaymentProduct
export const PaymentTransaction = _autoLoaded.PaymentTransaction
export const Post = _autoLoaded.Post
export const PrintDevice = _autoLoaded.PrintDevice
export const Product = _autoLoaded.Product
export const ProductUnit = _autoLoaded.ProductUnit
export const ProductVariant = _autoLoaded.ProductVariant
export const Receipt = _autoLoaded.Receipt
export const Release = _autoLoaded.Release
export const Request = _autoLoaded.Request
export const Review = _autoLoaded.Review
export const ShippingMethod = _autoLoaded.ShippingMethod
export const ShippingRate = _autoLoaded.ShippingRate
export const ShippingZone = _autoLoaded.ShippingZone
export const SocialPost = _autoLoaded.SocialPost
export const Subscriber = _autoLoaded.Subscriber
export const SubscriberEmail = _autoLoaded.SubscriberEmail
export const Subscription = _autoLoaded.Subscription
export const Tag = _autoLoaded.Tag
export const TaxRate = _autoLoaded.TaxRate
export const Team = _autoLoaded.Team
export const Transaction = _autoLoaded.Transaction
export const WaitlistProduct = _autoLoaded.WaitlistProduct
export const WaitlistRestaurant = _autoLoaded.WaitlistRestaurant
export const Websocket = _autoLoaded.Websocket

// Inject every loaded model onto globalThis so dashboard `<script server>`
// blocks can reference them as bare names (e.g. `await Order.all()`) without
// having to import. The STX engine evaluates server scripts inside an
// AsyncFunction wrapper, which inherits from globalThis — assigning here
// makes the names visible to every page render after orm has loaded.
const _allExports: Record<string, any> = {
  User,
  Job,
  FailedJob,
  ..._autoLoaded,
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
  InferFillableAttributes,
  InferPrimaryKey,
  InferTableName,
  InferRelationNames,
  InferNumericColumns,
  InferColumnNames,
  ModelDefinition,
  ModelRow,
  ModelRowLoose,
  ModelCreateData,
  ModelCreateDataLoose,
} from 'bun-query-builder'

// ---------------------------------------------------------------------------
// Model row types — inferred from model definitions via bun-query-builder.
// These replace hand-written interfaces and stay in sync automatically.
// Consumers: import type { UserModel, NewUser } from '@stacksjs/orm'
// ---------------------------------------------------------------------------

// Use a relative import to the User model file directly. Bun's linker still
// records `import type` paths for graph resolution, so importing through the
// auto-imports barrel here would re-introduce the cycle that the removed
// `export * from '../../../auto-imports/models'` (above) was meant to break.
// The single-model path keeps the type chain narrow.
import type _UserModel from '../../../../../app/Models/User'

/** User model row type — inferred from the User model definition. */
export type UserModel = ModelRowLoose<typeof _UserModel>

/** Data required to create a new User — inferred fillable attributes. */
export type NewUser = ModelCreateDataLoose<typeof _UserModel>

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
