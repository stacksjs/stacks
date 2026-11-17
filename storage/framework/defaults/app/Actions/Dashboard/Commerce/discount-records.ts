import type { DiscountRow } from '@stacksjs/commerce/discounts/rules'
import { applyDiscounts, discountLabel } from '@stacksjs/commerce/discounts/engine'
import { ruleFromDiscount } from '@stacksjs/commerce/discounts/rules'
import { formatCurrency } from '@stacksjs/commerce/money'
import { commerceIdentifier, commerceTimestamp, commerceValue } from './commerce-record'

/**
 * Discounts as the dashboard shows and writes them (the Discount model,
 * `commerce.discounts`). A record is what the engine reads, plus the labels a
 * table needs; a write is checked through the engine itself, so the dashboard
 * cannot save a discount that would fail at a shopper's checkout.
 */

export const DISCOUNT_TYPES = ['percentage', 'fixed_amount', 'buy_x_get_y', 'volume', 'free_shipping'] as const
export type DiscountType = typeof DISCOUNT_TYPES[number]
export type DiscountMethod = 'automatic' | 'code'
/** Where a discount stands now: the order the engine checks them in. */
export const DISCOUNT_STATES = ['active', 'scheduled', 'expired', 'exhausted', 'disabled'] as const
export type DiscountState = typeof DISCOUNT_STATES[number]

export interface DiscountTargetRecord {
  productIds: string[]
  variantIds: string[]
  categoryIds: string[]
}

export interface DiscountRecord {
  id: string
  title: string
  code: string
  method: DiscountMethod
  type: DiscountType
  /** Whole percent for `percentage`, minor units for `fixed_amount`, 0 otherwise. */
  value: number
  scope: '' | 'product' | 'order'
  perItem: boolean
  target: DiscountTargetRecord
  buyQuantity: number | null
  buyTarget: DiscountTargetRecord
  getQuantity: number | null
  getTarget: DiscountTargetRecord
  getPercent: number | null
  maxApplications: number | null
  tiers: Array<{ minQuantity: number, percent: number }>
  maxShipping: number | null
  minimumSubtotal: number | null
  minimumQuantity: number | null
  maxAmount: number | null
  combinesWith: { product: boolean, order: boolean, shipping: boolean }
  usageLimit: number | null
  usageCount: number
  isActive: boolean
  /** `YYYY-MM-DD`, the day it starts, or ''. */
  startsAt: string
  /** `YYYY-MM-DD`, the last day it runs, or ''. */
  endsAt: string
  state: DiscountState
  /** The badge a storefront shows: `BUY 4, GET 4 FREE`, `20% OFF`. */
  label: string
  /** product, order or shipping: what it takes money off. */
  appliesTo: 'product' | 'order' | 'shipping'
  /** Names of the products its targets name, by id, for showing them. */
  productLabels: Record<string, string>
  createdAt: string
}

export interface DiscountSummary {
  total: number
  automatic: number
  code: number
  active: number
  scheduled: number
  expired: number
  exhausted: number
  disabled: number
  /** Uses counted over every discount. */
  redemptions: number
  byType: Record<DiscountType, number>
  /** The five most used, by title on a tie. */
  mostUsed: Array<{ id: string, title: string, usageCount: number }>
}

export function emptyDiscountSummary(): DiscountSummary {
  return {
    total: 0,
    automatic: 0,
    code: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    exhausted: 0,
    disabled: 0,
    redemptions: 0,
    byType: { percentage: 0, fixed_amount: 0, buy_x_get_y: 0, volume: 0, free_shipping: 0 },
    mostUsed: [],
  }
}

/** `YYYY-MM-DD HH:MM:SS` (or a date) as the calendar day it names, or ''. */
function day(value: unknown): string {
  const text = value == null ? '' : String(value).trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function ids(list: readonly number[] | null | undefined): string[] {
  return (list ?? []).map(String)
}

function targetRecord(target: { productIds?: readonly number[] | null, variantIds?: readonly number[] | null, categoryIds?: readonly number[] | null } | null | undefined): DiscountTargetRecord {
  return { productIds: ids(target?.productIds), variantIds: ids(target?.variantIds), categoryIds: ids(target?.categoryIds) }
}

/** Where a discount stands at `now`, the order the engine checks in. */
export function discountState(row: Pick<DiscountRow, 'is_active' | 'starts_at' | 'ends_at' | 'usage_limit' | 'usage_count'>, now: string): DiscountState {
  const active = row.is_active == null || row.is_active === true || row.is_active === 1 || String(row.is_active) === '1' || String(row.is_active) === 'true'
  if (!active)
    return 'disabled'
  if (row.starts_at && String(row.starts_at) > now)
    return 'scheduled'
  if (row.ends_at && String(row.ends_at) < now)
    return 'expired'
  if (row.usage_limit != null && Number(row.usage_count ?? 0) >= Number(row.usage_limit))
    return 'exhausted'
  return 'active'
}

/**
 * One `discounts` row as a dashboard record. `now` is `YYYY-MM-DD HH:MM:SS` in
 * UTC, the way the rows store their dates. A row the engine cannot read throws
 * a TypeError naming it, like every commerce record normalizer.
 */
export function normalizeDiscountRecord(row: Record<string, unknown>, now: string, currency = 'USD', productNames: ReadonlyMap<number, string> = new Map()): DiscountRecord {
  const id = commerceIdentifier(commerceValue(row, 'id'), 'Discount')
  let rule
  try {
    rule = ruleFromDiscount(row as unknown as DiscountRow)
    applyDiscounts({ lines: [], rules: [rule] })
  }
  catch (error) {
    throw new TypeError(`Discount ${id} cannot be priced: ${error instanceof Error ? error.message : String(error)}`)
  }
  const effect = rule.effect
  const appliesTo = effect.type === 'free_shipping'
    ? 'shipping'
    : effect.type === 'buy_x_get_y' || effect.type === 'volume'
      ? 'product'
      : rule.scope ?? ((rule.target?.productIds?.length || rule.target?.variantIds?.length || rule.target?.categoryIds?.length) ? 'product' : 'order')

  const target = targetRecord(rule.target)
  const buyTarget = targetRecord(effect.type === 'buy_x_get_y' ? effect.buyTarget : null)
  const getTarget = targetRecord(effect.type === 'buy_x_get_y' ? effect.getTarget : null)
  const productLabels: Record<string, string> = {}
  for (const productId of [...target.productIds, ...buyTarget.productIds, ...getTarget.productIds])
    productLabels[productId] = productNames.get(Number(productId)) ?? `Product #${productId}`

  return {
    id,
    title: rule.title,
    code: rule.code ?? '',
    method: rule.code ? 'code' : 'automatic',
    type: effect.type,
    value: effect.type === 'percentage' ? effect.percent : effect.type === 'fixed_amount' ? effect.amount : 0,
    scope: rule.scope ?? '',
    perItem: effect.type === 'fixed_amount' && Boolean(effect.perItem),
    target,
    buyQuantity: effect.type === 'buy_x_get_y' ? effect.buyQuantity : null,
    buyTarget,
    getQuantity: effect.type === 'buy_x_get_y' ? effect.getQuantity : null,
    getTarget,
    getPercent: effect.type === 'buy_x_get_y' ? effect.getPercent : null,
    maxApplications: effect.type === 'buy_x_get_y' ? effect.maxApplications ?? null : null,
    tiers: effect.type === 'volume' ? [...effect.tiers].sort((a, b) => a.minQuantity - b.minQuantity) : [],
    maxShipping: effect.type === 'free_shipping' ? effect.maxShipping ?? null : null,
    minimumSubtotal: rule.minimumSubtotal ?? null,
    minimumQuantity: rule.minimumQuantity ?? null,
    maxAmount: rule.maxAmount ?? null,
    combinesWith: {
      product: Boolean(rule.combinesWith?.product),
      order: Boolean(rule.combinesWith?.order),
      shipping: Boolean(rule.combinesWith?.shipping),
    },
    usageLimit: rule.usageLimit ?? null,
    usageCount: Number(rule.usageCount ?? 0),
    isActive: rule.isActive !== false,
    startsAt: day(row.starts_at),
    endsAt: day(row.ends_at),
    state: discountState(row as unknown as DiscountRow, now),
    label: discountLabel(rule, minor => formatCurrency(minor, currency)),
    appliesTo,
    productLabels,
    createdAt: commerceTimestamp(commerceValue(row, 'created_at', 'createdAt'), `Discount ${id}`),
  }
}

/** What the dashboard's dialog sends. */
export interface DiscountWritePayload {
  title?: unknown
  method?: unknown
  code?: unknown
  type?: unknown
  value?: unknown
  scope?: unknown
  perItem?: unknown
  target?: unknown
  buyQuantity?: unknown
  buyTarget?: unknown
  getQuantity?: unknown
  getTarget?: unknown
  getPercent?: unknown
  maxApplications?: unknown
  tiers?: unknown
  maxShipping?: unknown
  minimumSubtotal?: unknown
  minimumQuantity?: unknown
  maxAmount?: unknown
  combinesWith?: unknown
  usageLimit?: unknown
  isActive?: unknown
  startsAt?: unknown
  endsAt?: unknown
}

export type DiscountWriteResult =
  | { ok: true, data: Record<string, unknown> }
  | { ok: false, errors: Record<string, string> }

function optionalWhole(value: unknown, field: string, errors: Record<string, string>, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (value === undefined || value === null || value === '')
    return null
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    errors[field] = max === Number.MAX_SAFE_INTEGER ? `must be a whole number of at least ${min}` : `must be a whole number from ${min} to ${max}`
    return null
  }
  return n
}

function idList(value: unknown): number[] {
  if (!Array.isArray(value))
    return []
  return [...new Set(value.map(Number).filter(n => Number.isSafeInteger(n) && n > 0))]
}

function targetJson(value: unknown): string | null {
  const target = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const out = { productIds: idList(target.productIds), variantIds: idList(target.variantIds), categoryIds: idList(target.categoryIds) }
  return out.productIds.length || out.variantIds.length || out.categoryIds.length ? JSON.stringify(out) : null
}

function dateColumn(value: unknown, field: string, endOfDay: boolean, errors: Record<string, string>): string | null {
  const text = value == null ? '' : String(value).trim()
  if (!text)
    return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    errors[field] = 'must be a date'
    return null
  }
  // Stored like every timestamp here (UTC, `formatDate`): from the first
  // second of the start day through the last second of the end day.
  return `${text} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

/**
 * A dialog payload as the columns to write, or the field errors. The rule is
 * then priced once through the engine, so anything it would refuse at
 * checkout (a 120% discount, a tier of 0 units) is refused here, by field.
 */
export function discountWriteData(payload: DiscountWritePayload): DiscountWriteResult {
  const errors: Record<string, string> = {}
  const title = String(payload.title ?? '').trim()
  if (!title)
    errors.title = 'is required'
  else if (title.length > 255)
    errors.title = 'must be 255 characters or fewer'

  const method = payload.method === 'code' ? 'code' : 'automatic'
  const code = method === 'code' ? String(payload.code ?? '').trim().toUpperCase() : ''
  if (method === 'code' && !code)
    errors.code = 'is required for a discount code'
  else if (code.length > 64)
    errors.code = 'must be 64 characters or fewer'
  else if (code && !/^[A-Z0-9_-]+$/.test(code))
    errors.code = 'may use letters, digits, - and _ only'

  const type = String(payload.type ?? '') as DiscountType
  if (!(DISCOUNT_TYPES as readonly string[]).includes(type))
    errors.type = `must be one of ${DISCOUNT_TYPES.join(', ')}`

  let value = 0
  if (type === 'percentage' || type === 'fixed_amount') {
    const given = optionalWhole(payload.value, 'value', errors, 1, type === 'percentage' ? 100 : Number.MAX_SAFE_INTEGER)
    if (given === null && !errors.value)
      errors.value = 'is required'
    value = given ?? 0
  }

  const scope = payload.scope === 'product' || payload.scope === 'order' ? payload.scope : null
  const target = targetJson(payload.target)
  if (scope === 'product' && !target && (type === 'percentage' || type === 'fixed_amount'))
    errors.target = 'choose the products it applies to'

  let tiers: string | null = null
  if (type === 'volume') {
    const list = Array.isArray(payload.tiers) ? payload.tiers : []
    const parsed = list.map(t => ({ minQuantity: Number((t as any)?.minQuantity), percent: Number((t as any)?.percent) }))
    if (parsed.length === 0)
      errors.tiers = 'add at least one tier'
    else if (parsed.some(t => !Number.isSafeInteger(t.minQuantity) || t.minQuantity < 1 || !Number.isSafeInteger(t.percent) || t.percent < 1 || t.percent > 100))
      errors.tiers = 'each tier needs a quantity of at least 1 and a whole percent from 1 to 100'
    else if (new Set(parsed.map(t => t.minQuantity)).size !== parsed.length)
      errors.tiers = 'two tiers cannot start at the same quantity'
    else
      tiers = JSON.stringify(parsed.sort((a, b) => a.minQuantity - b.minQuantity))
  }

  const buyQuantity = type === 'buy_x_get_y' ? optionalWhole(payload.buyQuantity, 'buyQuantity', errors, 1) : null
  const getQuantity = type === 'buy_x_get_y' ? optionalWhole(payload.getQuantity, 'getQuantity', errors, 1) : null
  const getPercent = type === 'buy_x_get_y' ? optionalWhole(payload.getPercent, 'getPercent', errors, 1, 100) : null
  if (type === 'buy_x_get_y') {
    if (buyQuantity === null && !errors.buyQuantity)
      errors.buyQuantity = 'is required'
    if (getQuantity === null && !errors.getQuantity)
      errors.getQuantity = 'is required'
    if (getPercent === null && !errors.getPercent)
      errors.getPercent = 'is required'
  }

  const combines = (payload.combinesWith && typeof payload.combinesWith === 'object' ? payload.combinesWith : {}) as Record<string, unknown>
  const startsAt = dateColumn(payload.startsAt, 'startsAt', false, errors)
  const endsAt = dateColumn(payload.endsAt, 'endsAt', true, errors)
  if (startsAt && endsAt && endsAt < startsAt)
    errors.endsAt = 'must be on or after the start date'

  const data: Record<string, unknown> = {
    title,
    code: code || null,
    type,
    value,
    scope: type === 'percentage' || type === 'fixed_amount' ? scope : null,
    per_item: type === 'fixed_amount' && payload.perItem === true,
    target: type === 'free_shipping' ? null : target,
    buy_quantity: buyQuantity,
    buy_target: type === 'buy_x_get_y' ? targetJson(payload.buyTarget) : null,
    get_quantity: getQuantity,
    get_target: type === 'buy_x_get_y' ? targetJson(payload.getTarget) : null,
    get_percent: getPercent,
    max_applications: type === 'buy_x_get_y' ? optionalWhole(payload.maxApplications, 'maxApplications', errors, 1) : null,
    tiers,
    max_shipping: type === 'free_shipping' ? optionalWhole(payload.maxShipping, 'maxShipping', errors, 0) : null,
    minimum_subtotal: optionalWhole(payload.minimumSubtotal, 'minimumSubtotal', errors, 0),
    minimum_quantity: optionalWhole(payload.minimumQuantity, 'minimumQuantity', errors, 0),
    max_amount: type === 'free_shipping' ? null : optionalWhole(payload.maxAmount, 'maxAmount', errors, 1),
    combines_with_product: combines.product === true,
    combines_with_order: combines.order === true,
    combines_with_shipping: combines.shipping === true,
    usage_limit: optionalWhole(payload.usageLimit, 'usageLimit', errors, 1),
    is_active: payload.isActive !== false,
    starts_at: startsAt,
    ends_at: endsAt,
  }

  if (Object.keys(errors).length > 0)
    return { ok: false, errors }

  try {
    applyDiscounts({ lines: [], rules: [ruleFromDiscount({ id: 0, ...data } as unknown as DiscountRow)] })
  }
  catch (error) {
    return { ok: false, errors: { type: error instanceof Error ? error.message : String(error) } }
  }

  return { ok: true, data }
}

/** Every product id a `discounts` row's targets name, for looking their names up. */
export function discountProductIds(row: Record<string, unknown>): number[] {
  const ids: number[] = []
  for (const column of ['target', 'buy_target', 'get_target']) {
    const raw = row[column]
    if (typeof raw !== 'string' || !raw)
      continue
    try {
      const parsed = JSON.parse(raw) as { productIds?: unknown }
      if (Array.isArray(parsed.productIds))
        ids.push(...parsed.productIds.map(Number).filter(n => Number.isSafeInteger(n) && n > 0))
    }
    catch {
      // An unreadable target is the normalizer's to report.
    }
  }
  return [...new Set(ids)]
}
