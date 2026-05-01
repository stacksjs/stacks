/**
 * Shared dashboard server-side helpers.
 *
 * Dashboard `.stx` pages run a `<script server>` block at request time,
 * import the framework's ORM, query for data, and shape it for the
 * template. Several pages need the same primitives — a safe model load
 * (the orm package only re-exports User/Job/FailedJob, the rest must be
 * loaded by file path), null-tolerant getters, and small aggregation
 * helpers — so they live here instead of being copy-pasted into every
 * page header.
 *
 * Usage from inside a page's `<script server>`:
 *
 *   const { loadModel, safeAll, safeGet, countBy } =
 *     await import('../../../resources/functions/dashboard/data')
 *   const Order = await loadModel('Order')
 *   const orders = await safeAll(Order)
 *   const byStatus = countBy(orders, 'status')
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let projectRootCache: string | null = null

function projectRoot(): string {
  if (projectRootCache) return projectRootCache
  // Walk up from this file location to find the project root (the dir
  // that contains `storage/framework/defaults`). This mirrors what
  // `@stacksjs/path` does, but without pulling in the path package
  // (which has its own evaluation graph and would slow page renders).
  let dir = dirname(new URL(import.meta.url).pathname)
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'storage/framework/defaults'))) {
      projectRootCache = dir
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // Fall back to cwd — STX serves run from the project root.
  projectRootCache = process.cwd()
  return projectRootCache
}

/**
 * Map of model name → list of relative paths to try, in order. The first
 * existing file wins. User overrides at `app/Models/<Name>.ts` always
 * take priority over framework defaults. The defaults are organised in
 * subdirectories (commerce/, Content/, realtime/) so each model needs an
 * explicit lookup table — globbing at request time would add ~50ms per
 * page render.
 */
const MODEL_PATHS: Record<string, string[]> = {
  // Auth / core
  User: ['app/Models/User.ts', 'storage/framework/defaults/app/Models/User.ts'],
  Team: ['app/Models/Team.ts', 'storage/framework/defaults/app/Models/Team.ts'],
  Subscriber: ['app/Models/Subscriber.ts', 'storage/framework/defaults/app/Models/Subscriber.ts'],
  SubscriberEmail: ['app/Models/SubscriberEmail.ts', 'storage/framework/defaults/app/Models/SubscriberEmail.ts'],
  Subscription: ['app/Models/Subscription.ts', 'storage/framework/defaults/app/Models/Subscription.ts'],

  // Content
  Post: ['app/Models/Post.ts', 'storage/framework/defaults/app/Models/Content/Post.ts'],
  Page: ['app/Models/Page.ts', 'storage/framework/defaults/app/Models/Content/Page.ts'],
  Author: ['app/Models/Author.ts', 'storage/framework/defaults/app/Models/Content/Author.ts'],
  Comment: ['app/Models/Comment.ts', 'storage/framework/defaults/app/Models/Comment.ts'],
  Tag: ['app/Models/Tag.ts', 'storage/framework/defaults/app/Models/Tag.ts'],
  Category: ['app/Models/Category.ts', 'storage/framework/defaults/app/Models/commerce/Category.ts'],

  // App / operations
  Activity: ['app/Models/Activity.ts', 'storage/framework/defaults/app/Models/Activity.ts'],
  Deployment: ['app/Models/Deployment.ts', 'storage/framework/defaults/app/Models/Deployment.ts'],
  Release: ['app/Models/Release.ts', 'storage/framework/defaults/app/Models/Release.ts'],
  Notification: ['app/Models/Notification.ts', 'storage/framework/defaults/app/Models/Notification.ts'],
  Job: ['app/Models/Job.ts', 'storage/framework/defaults/app/Models/Job.ts'],
  FailedJob: ['app/Models/FailedJob.ts', 'storage/framework/defaults/app/Models/FailedJob.ts'],
  Log: ['app/Models/Log.ts', 'storage/framework/defaults/app/Models/Log.ts'],
  Request: ['app/Models/Request.ts', 'storage/framework/defaults/app/Models/Request.ts'],
  Error: ['app/Models/Error.ts', 'storage/framework/defaults/app/Models/Error.ts'],
  Websocket: ['app/Models/Websocket.ts', 'storage/framework/defaults/app/Models/realtime/Websocket.ts'],

  // Marketing
  Campaign: ['app/Models/Campaign.ts', 'storage/framework/defaults/app/Models/Campaign.ts'],
  EmailList: ['app/Models/EmailList.ts', 'storage/framework/defaults/app/Models/EmailList.ts'],
  SocialPost: ['app/Models/SocialPost.ts', 'storage/framework/defaults/app/Models/SocialPost.ts'],

  // Commerce
  Order: ['app/Models/Order.ts', 'storage/framework/defaults/app/Models/commerce/Order.ts'],
  OrderItem: ['app/Models/OrderItem.ts', 'storage/framework/defaults/app/Models/commerce/OrderItem.ts'],
  Cart: ['app/Models/Cart.ts', 'storage/framework/defaults/app/Models/commerce/Cart.ts'],
  CartItem: ['app/Models/CartItem.ts', 'storage/framework/defaults/app/Models/commerce/CartItem.ts'],
  Customer: ['app/Models/Customer.ts', 'storage/framework/defaults/app/Models/commerce/Customer.ts'],
  Product: ['app/Models/Product.ts', 'storage/framework/defaults/app/Models/commerce/Product.ts'],
  ProductVariant: ['app/Models/ProductVariant.ts', 'storage/framework/defaults/app/Models/commerce/ProductVariant.ts'],
  ProductUnit: ['app/Models/ProductUnit.ts', 'storage/framework/defaults/app/Models/commerce/ProductUnit.ts'],
  Manufacturer: ['app/Models/Manufacturer.ts', 'storage/framework/defaults/app/Models/commerce/Manufacturer.ts'],
  Coupon: ['app/Models/Coupon.ts', 'storage/framework/defaults/app/Models/commerce/Coupon.ts'],
  GiftCard: ['app/Models/GiftCard.ts', 'storage/framework/defaults/app/Models/commerce/GiftCard.ts'],
  LicenseKey: ['app/Models/LicenseKey.ts', 'storage/framework/defaults/app/Models/commerce/LicenseKey.ts'],
  Review: ['app/Models/Review.ts', 'storage/framework/defaults/app/Models/commerce/Review.ts'],
  Receipt: ['app/Models/Receipt.ts', 'storage/framework/defaults/app/Models/commerce/Receipt.ts'],
  PrintDevice: ['app/Models/PrintDevice.ts', 'storage/framework/defaults/app/Models/commerce/PrintDevice.ts'],
  ShippingMethod: ['app/Models/ShippingMethod.ts', 'storage/framework/defaults/app/Models/commerce/ShippingMethod.ts'],
  ShippingRate: ['app/Models/ShippingRate.ts', 'storage/framework/defaults/app/Models/commerce/ShippingRate.ts'],
  ShippingZone: ['app/Models/ShippingZone.ts', 'storage/framework/defaults/app/Models/commerce/ShippingZone.ts'],
  DeliveryRoute: ['app/Models/DeliveryRoute.ts', 'storage/framework/defaults/app/Models/commerce/DeliveryRoute.ts'],
  DigitalDelivery: ['app/Models/DigitalDelivery.ts', 'storage/framework/defaults/app/Models/commerce/DigitalDelivery.ts'],
  Driver: ['app/Models/Driver.ts', 'storage/framework/defaults/app/Models/commerce/Driver.ts'],
  TaxRate: ['app/Models/TaxRate.ts', 'storage/framework/defaults/app/Models/commerce/TaxRate.ts'],
  WaitlistProduct: ['app/Models/WaitlistProduct.ts', 'storage/framework/defaults/app/Models/commerce/WaitlistProduct.ts'],
  WaitlistRestaurant: ['app/Models/WaitlistRestaurant.ts', 'storage/framework/defaults/app/Models/commerce/WaitlistRestaurant.ts'],
  LoyaltyPoint: ['app/Models/LoyaltyPoint.ts', 'storage/framework/defaults/app/Models/commerce/LoyaltyPoint.ts'],
  LoyaltyReward: ['app/Models/LoyaltyReward.ts', 'storage/framework/defaults/app/Models/commerce/LoyaltyReward.ts'],
  Payment: ['app/Models/Payment.ts', 'storage/framework/defaults/app/Models/commerce/Payment.ts'],
  PaymentMethod: ['app/Models/PaymentMethod.ts', 'storage/framework/defaults/app/Models/PaymentMethod.ts'],
  PaymentProduct: ['app/Models/PaymentProduct.ts', 'storage/framework/defaults/app/Models/PaymentProduct.ts'],
  PaymentTransaction: ['app/Models/PaymentTransaction.ts', 'storage/framework/defaults/app/Models/PaymentTransaction.ts'],
  Transaction: ['app/Models/Transaction.ts', 'storage/framework/defaults/app/Models/commerce/Transaction.ts'],
}

const modelCache = new Map<string, any>()

/**
 * Load a model class by name, searching userland first then framework
 * defaults. Returns a stub with no-op `.all()` / `.orderBy()` / `.count()`
 * methods if the model file doesn't exist or fails to import — pages can
 * always call query methods on the result without try/catch around the
 * load itself.
 */
export async function loadModel(name: string): Promise<any> {
  if (modelCache.has(name)) return modelCache.get(name)

  const candidates = MODEL_PATHS[name]
  if (!candidates) {
    const stub = makeStub(name)
    modelCache.set(name, stub)
    return stub
  }

  const root = projectRoot()
  for (const rel of candidates) {
    const abs = resolve(root, rel)
    if (!existsSync(abs)) continue
    try {
      const mod = await import(abs)
      const M = mod?.default ?? mod
      if (M) {
        modelCache.set(name, M)
        return M
      }
    }
    catch {
      // Try the next candidate path; final fallback is the stub below.
    }
  }

  const stub = makeStub(name)
  modelCache.set(name, stub)
  return stub
}

/**
 * Load several models at once. Resolves to a record so callers can
 * destructure: `const { Order, Product } = await loadModels(['Order', 'Product'])`.
 */
export async function loadModels<T extends string>(names: T[]): Promise<Record<T, any>> {
  const out = {} as Record<T, any>
  await Promise.all(names.map(async (n) => {
    out[n] = await loadModel(n)
  }))
  return out
}

function makeStub(_name: string): any {
  const empty: any[] = []
  const chain: any = {
    get: async () => empty,
    all: async () => empty,
    count: async () => 0,
    first: async () => null,
    find: async () => null,
    where: () => chain,
    orderBy: () => chain,
    orderByDesc: () => chain,
    limit: () => chain,
    take: () => chain,
    skip: () => chain,
    select: () => chain,
    distinct: () => chain,
    groupBy: () => chain,
    whereIn: () => chain,
    whereNotNull: () => chain,
    whereNull: () => chain,
    _isStub: true,
  }
  return chain
}

/**
 * Run `Model.all()` and always resolve to an array — never throws, never
 * returns undefined. Use this whenever you need every row of a table for
 * the page (the seeder caps each table at ~50 rows so the cost is fine).
 */
export async function safeAll(Model: any): Promise<any[]> {
  if (!Model) return []
  try {
    if (typeof Model.all === 'function') {
      const rows = await Model.all()
      return Array.isArray(rows) ? rows : []
    }
    if (typeof Model.get === 'function') {
      const rows = await Model.get()
      return Array.isArray(rows) ? rows : []
    }
  }
  catch {
    // DB unreachable / table missing / model schema mismatch — page
    // should render an empty state, not a 500.
  }
  return []
}

/**
 * Read a column off a model row, tolerating both proxy-style rows
 * (`row.get('name')`) and plain object rows (`row.name`). Returns the
 * fallback when the column is missing or null/undefined.
 */
export function safeGet(row: any, key: string, fallback: any = ''): any {
  if (!row) return fallback
  try {
    if (typeof row.get === 'function') {
      const v = row.get(key)
      if (v !== undefined && v !== null) return v
    }
  }
  catch { /* fall through to direct property access */ }
  const direct = row[key]
  return direct !== undefined && direct !== null ? direct : fallback
}

/** Group rows by the value of a column. */
export function countBy(rows: any[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const v = String(safeGet(r, key, '') || 'unknown')
    out[v] = (out[v] || 0) + 1
  }
  return out
}

/** Sum a numeric column across rows. */
export function sumBy(rows: any[], key: string): number {
  let total = 0
  for (const r of rows) {
    const v = Number(safeGet(r, key, 0)) || 0
    total += v
  }
  return total
}

/** Top N values of a column with their counts, sorted desc. */
export function topN(rows: any[], key: string, n = 5): Array<{ value: string, count: number }> {
  const counts = countBy(rows, key)
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

/**
 * Group rows into buckets by ISO date. Returns a window of `days` from
 * today backwards, with zero-counts for empty days so charts render a
 * smooth line. Date column is parsed as `Date(value)`.
 */
export function groupByDay(
  rows: any[],
  key: string,
  days = 30,
): Array<{ date: string, count: number }> {
  const buckets: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  for (const r of rows) {
    const raw = safeGet(r, key, null)
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const k = d.toISOString().slice(0, 10)
    if (k in buckets) buckets[k]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

/**
 * Sum a numeric column into per-day buckets. Same windowing semantics as
 * `groupByDay` — useful for revenue-over-time charts.
 */
export function sumByDay(
  rows: any[],
  dateKey: string,
  valueKey: string,
  days = 30,
): Array<{ date: string, total: number }> {
  const buckets: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  for (const r of rows) {
    const raw = safeGet(r, dateKey, null)
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const k = d.toISOString().slice(0, 10)
    if (!(k in buckets)) continue
    buckets[k] += Number(safeGet(r, valueKey, 0)) || 0
  }
  return Object.entries(buckets).map(([date, total]) => ({ date, total }))
}

/** "5m ago" / "2h ago" / "3d ago" style relative time. Stable on server. */
export function formatRelative(input: any): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return String(input)
  const diff = Math.max(0, Date.now() - d.getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.floor(mo / 12)
  return `${yr}y ago`
}

/** Format any value as USD with no fractional cents for whole numbers. */
export function formatCurrency(value: any): string {
  const n = Number(value) || 0
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
