/**
 * Shared dashboard server-side helpers.
 *
 * Dashboard `.stx` pages run a `<script server>` block at request time,
 * import the framework's ORM, query for data, and shape it for the
 * template. Several pages need the same primitives: strict model loading,
 * null-tolerant getters, and small aggregation helpers. They live here
 * instead of being copied into every page header.
 *
 * Usage from inside a page's `<script server>`:
 *
 *   const { loadModel, allRows, safeGet, countBy } =
 *     await import('../../../resources/functions/dashboard/data')
 *   const Order = await loadModel('Order')
 *   const orders = await allRows(Order)
 *   const byStatus = countBy(orders, 'status')
 */

import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { defaultsPath, projectPath } from '@stacksjs/path'

/**
 * The project root, and where the defaults tree is, both from
 * `@stacksjs/path`.
 *
 * This file used to hand-roll the walk, explicitly to avoid importing the
 * path package, which was recorded as having "its own evaluation graph" that
 * "would slow page renders". Measured rather than inherited: importing
 * `@stacksjs/path` in this checkout costs 1.5-2.7ms, once per process because
 * the module cache holds it, not once per render. `preloader.ts` next door
 * already imports it.
 *
 * The walk also had to go, independently of cost. It anchored on a directory
 * containing `storage/framework/defaults`, which is the one directory
 * stacksjs/stacks#2941 is removing: in a project resolving its defaults from
 * `node_modules`, the walk would find no anchor and fall through to
 * `process.cwd()`, which is right only by luck.
 */
function projectRoot(): string {
  return projectPath()
}

/**
 * Fast-path map of common model names to the two places they can live:
 * `[path under the project, path under the defaults tree]`.
 *
 * The first existing file wins, and user overrides always take priority over
 * framework defaults. A cached filesystem index below covers newly-added and
 * nested models, so this map is an optimization rather than a correctness
 * requirement.
 *
 * The second element is relative to the defaults tree rather than to the
 * project, because that tree is not always inside the project: it is
 * `storage/framework/defaults` when the project vendors a current copy and the
 * installed `@stacksjs/defaults` otherwise (stacksjs/stacks#2941). Fifty-five
 * rows used to spell `storage/framework/defaults/` out by hand.
 */
const MODEL_PATHS: Record<string, [string, string]> = {
  // Auth / core
  User: ['app/Models/User.ts', 'app/Models/User.ts'],
  Team: ['app/Models/Team.ts', 'app/Models/Team.ts'],
  Subscriber: ['app/Models/Subscriber.ts', 'app/Models/Subscriber.ts'],
  SubscriberEmail: ['app/Models/SubscriberEmail.ts', 'app/Models/SubscriberEmail.ts'],
  Subscription: ['app/Models/Subscription.ts', 'app/Models/Subscription.ts'],

  // Content
  Post: ['app/Models/Post.ts', 'app/Models/Content/Post.ts'],
  Page: ['app/Models/Page.ts', 'app/Models/Content/Page.ts'],
  Author: ['app/Models/Author.ts', 'app/Models/Content/Author.ts'],
  Comment: ['app/Models/Comment.ts', 'app/Models/Comment.ts'],
  Tag: ['app/Models/Tag.ts', 'app/Models/Tag.ts'],
  Category: ['app/Models/Category.ts', 'app/Models/commerce/Category.ts'],

  // App / operations
  Activity: ['app/Models/Activity.ts', 'app/Models/Activity.ts'],
  Deployment: ['app/Models/Deployment.ts', 'app/Models/Deployment.ts'],
  Release: ['app/Models/Release.ts', 'app/Models/Release.ts'],
  Notification: ['app/Models/Notification.ts', 'app/Models/Notification.ts'],
  Job: ['app/Models/Job.ts', 'app/Models/Job.ts'],
  FailedJob: ['app/Models/FailedJob.ts', 'app/Models/FailedJob.ts'],
  Log: ['app/Models/Log.ts', 'app/Models/Log.ts'],
  Request: ['app/Models/Request.ts', 'app/Models/Request.ts'],
  Error: ['app/Models/Error.ts', 'app/Models/Error.ts'],
  Websocket: ['app/Models/Websocket.ts', 'app/Models/realtime/Websocket.ts'],

  // Marketing
  Campaign: ['app/Models/Campaign.ts', 'app/Models/Campaign.ts'],
  EmailList: ['app/Models/EmailList.ts', 'app/Models/EmailList.ts'],
  SocialPost: ['app/Models/SocialPost.ts', 'app/Models/SocialPost.ts'],

  // Commerce
  Order: ['app/Models/Order.ts', 'app/Models/commerce/Order.ts'],
  OrderItem: ['app/Models/OrderItem.ts', 'app/Models/commerce/OrderItem.ts'],
  Cart: ['app/Models/Cart.ts', 'app/Models/commerce/Cart.ts'],
  CartItem: ['app/Models/CartItem.ts', 'app/Models/commerce/CartItem.ts'],
  Customer: ['app/Models/Customer.ts', 'app/Models/commerce/Customer.ts'],
  Product: ['app/Models/Product.ts', 'app/Models/commerce/Product.ts'],
  ProductVariant: ['app/Models/ProductVariant.ts', 'app/Models/commerce/ProductVariant.ts'],
  ProductUnit: ['app/Models/ProductUnit.ts', 'app/Models/commerce/ProductUnit.ts'],
  Manufacturer: ['app/Models/Manufacturer.ts', 'app/Models/commerce/Manufacturer.ts'],
  Coupon: ['app/Models/Coupon.ts', 'app/Models/commerce/Coupon.ts'],
  GiftCard: ['app/Models/GiftCard.ts', 'app/Models/commerce/GiftCard.ts'],
  LicenseKey: ['app/Models/LicenseKey.ts', 'app/Models/commerce/LicenseKey.ts'],
  Review: ['app/Models/Review.ts', 'app/Models/commerce/Review.ts'],
  Receipt: ['app/Models/Receipt.ts', 'app/Models/commerce/Receipt.ts'],
  PrintDevice: ['app/Models/PrintDevice.ts', 'app/Models/commerce/PrintDevice.ts'],
  ShippingMethod: ['app/Models/ShippingMethod.ts', 'app/Models/commerce/ShippingMethod.ts'],
  ShippingRate: ['app/Models/ShippingRate.ts', 'app/Models/commerce/ShippingRate.ts'],
  ShippingZone: ['app/Models/ShippingZone.ts', 'app/Models/commerce/ShippingZone.ts'],
  DeliveryRoute: ['app/Models/DeliveryRoute.ts', 'app/Models/commerce/DeliveryRoute.ts'],
  DigitalDelivery: ['app/Models/DigitalDelivery.ts', 'app/Models/commerce/DigitalDelivery.ts'],
  Courier: ['app/Models/Courier.ts', 'app/Models/commerce/Courier.ts'],
  TaxRate: ['app/Models/TaxRate.ts', 'app/Models/commerce/TaxRate.ts'],
  WaitlistProduct: ['app/Models/WaitlistProduct.ts', 'app/Models/commerce/WaitlistProduct.ts'],
  WaitlistRestaurant: ['app/Models/WaitlistRestaurant.ts', 'app/Models/commerce/WaitlistRestaurant.ts'],
  LoyaltyPoint: ['app/Models/LoyaltyPoint.ts', 'app/Models/commerce/LoyaltyPoint.ts'],
  LoyaltyReward: ['app/Models/LoyaltyReward.ts', 'app/Models/commerce/LoyaltyReward.ts'],
  Payment: ['app/Models/Payment.ts', 'app/Models/commerce/Payment.ts'],
  PaymentMethod: ['app/Models/PaymentMethod.ts', 'app/Models/PaymentMethod.ts'],
  PaymentProduct: ['app/Models/PaymentProduct.ts', 'app/Models/PaymentProduct.ts'],
  PaymentTransaction: ['app/Models/PaymentTransaction.ts', 'app/Models/PaymentTransaction.ts'],
  Transaction: ['app/Models/Transaction.ts', 'app/Models/commerce/Transaction.ts'],
}

const modelCache = new Map<string, any>()
let discoveredModelPathsPromise: Promise<Map<string, string[]>> | null = null

/**
 * Index every model file once so newly-added framework models and nested
 * user models do not also need a hand-maintained entry in MODEL_PATHS.
 * Userland is scanned first to preserve the app/ override contract.
 */
async function discoverModelPaths(): Promise<Map<string, string[]>> {
  if (discoveredModelPathsPromise)
    return discoveredModelPathsPromise

  discoveredModelPathsPromise = (async () => {
    const root = projectRoot()
    const paths = new Map<string, string[]>()
    const modelRoots = [
      resolve(root, 'app/Models'),
      defaultsPath('app/Models'),
    ]

    for (const modelsRoot of modelRoots) {
      if (!existsSync(modelsRoot))
        continue

      const glob = new Bun.Glob('**/*.ts')
      for await (const relativePath of glob.scan({ cwd: modelsRoot, onlyFiles: true })) {
        if (relativePath.endsWith('.test.ts') || relativePath.endsWith('.d.ts'))
          continue
        const name = basename(relativePath, '.ts')
        const candidates = paths.get(name) ?? []
        candidates.push(resolve(modelsRoot, relativePath))
        paths.set(name, candidates)
      }
    }

    return paths
  })()

  return discoveredModelPathsPromise
}

async function modelCandidatePaths(name: string): Promise<string[]> {
  const discovered = (await discoverModelPaths()).get(name) ?? []
  const entry = MODEL_PATHS[name]
  const explicit = entry
    ? [resolve(projectRoot(), entry[0]), defaultsPath(entry[1])]
    : []
  return [...new Set([...discovered, ...explicit])]
}

export class DashboardModelLoadError extends Error {
  readonly modelName: string

  constructor(modelName: string, detail: string) {
    super(`Could not load dashboard model ${modelName}: ${detail}`)
    this.name = 'DashboardModelLoadError'
    this.modelName = modelName
  }
}

async function importModel(name: string): Promise<any | null> {
  if (modelCache.has(name)) return modelCache.get(name)

  const candidates = await modelCandidatePaths(name)

  for (const abs of candidates) {
    if (!existsSync(abs)) continue
    try {
      const mod = await import(abs)
      const M = mod?.default ?? mod
      if (M) {
        modelCache.set(name, M)
        return M
      }
      throw new DashboardModelLoadError(name, `${abs} did not export a model`)
    }
    catch (error) {
      if (error instanceof DashboardModelLoadError)
        throw error
      throw new DashboardModelLoadError(name, `${abs}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return null
}

/**
 * Load a model class by name, searching userland first and then framework
 * defaults. Missing files and import failures are explicit errors so a
 * broken model can never be presented as a healthy empty table.
 */
export async function loadModel(name: string): Promise<any> {
  const Model = await importModel(name)
  if (!Model)
    throw new DashboardModelLoadError(name, 'no matching model file exists')
  return Model
}

/**
 * Resolve a model when the caller intentionally supports model-less tables.
 * Import failures still throw. Only a genuinely absent model resolves null.
 */
export async function loadModelIfExists(name: string): Promise<any | null> {
  return await importModel(name)
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

/**
 * Read every row from a model. Invalid model APIs, query errors, and invalid
 * return values stay visible to the endpoint instead of becoming fake
 * empty datasets.
 */
export async function allRows(Model: any): Promise<any[]> {
  if (!Model)
    throw new TypeError('A model is required to read dashboard rows.')

  let rows: unknown
  if (typeof Model.all === 'function') {
    rows = await Model.all()
  }
  else if (typeof Model.get === 'function') {
    rows = await Model.get()
  }
  else {
    throw new TypeError('The dashboard model does not expose all() or get().')
  }

  if (!Array.isArray(rows))
    throw new TypeError('The dashboard model row query did not return an array.')
  return rows
}

/**
 * Count model rows. Models without a count method use the real row query;
 * query failures are never converted to a healthy zero.
 */
export async function countRows(Model: any): Promise<number> {
  if (!Model)
    throw new TypeError('A model is required to count dashboard rows.')

  if (typeof Model.count === 'function') {
    const count = Number(await Model.count())
    if (!Number.isFinite(count))
      throw new TypeError('The dashboard model count query did not return a finite number.')
    return count
  }

  return (await allRows(Model)).length
}

/**
 * Read a column off a model row, tolerating both proxy-style rows
 * (`row.get('name')`) and plain object rows (`row.name`). Returns the
 * fallback when the column is missing or null/undefined.
 */
export function safeGet(row: any, key: string, fallback: any = ''): any {
  if (!row) return fallback
  if (typeof row.get === 'function') {
    const value = row.get(key)
    if (value !== undefined && value !== null) return value
  }
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
    if (k in buckets) buckets[k] = (buckets[k] ?? 0) + 1
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
    buckets[k] = (buckets[k] ?? 0) + (Number(safeGet(r, valueKey, 0)) || 0)
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
