import { commerceIdentifier, commerceTimestamp, commerceValue } from './commerce-record'

/**
 * Post-purchase offers as the dashboard shows and writes them (the
 * PostPurchaseOffer model, `commerce.upsells`), each with the funnel its
 * responses add up to: shown, taken, turned down, and what it added to orders.
 */

export const UPSELL_STATES = ['running', 'scheduled', 'ended', 'disabled'] as const
export type UpsellState = typeof UPSELL_STATES[number]

export interface UpsellProductRef {
  id: string
  label: string
  /** False when the product has been deleted since the offer was made. */
  exists: boolean
}

export interface UpsellStats {
  /** Products shown, one per order and product. */
  views: number
  accepted: number
  declined: number
  pending: number
  failed: number
  /** Accepted over shown, 0 to 1. */
  conversionRate: number
  /** Minor units added to orders. */
  revenue: number
  units: number
}

export interface UpsellOfferRecord {
  id: string
  name: string
  headline: string
  message: string
  products: UpsellProductRef[]
  discountPercent: number
  minQuantity: number
  defaultQuantity: number
  maxQuantity: number | null
  triggerProducts: UpsellProductRef[]
  /** Minor units, or null for any order. */
  minOrderTotal: number | null
  windowMinutes: number
  priority: number
  isActive: boolean
  startsAt: string
  endsAt: string
  state: UpsellState
  stats: UpsellStats
  createdAt: string
}

export interface UpsellSummary {
  total: number
  running: number
  views: number
  accepted: number
  declined: number
  conversionRate: number
  revenue: number
  units: number
  /** The five offers that added the most, by name on a tie. */
  top: Array<{ id: string, name: string, revenue: number, conversionRate: number }>
}

export interface UpsellResponseRecord {
  id: string
  orderId: string
  status: 'viewed' | 'pending' | 'accepted' | 'declined' | 'failed'
  productId: string
  productLabel: string
  variantId: string
  quantity: number | null
  unitPrice: number | null
  compareAtPrice: number | null
  amount: number | null
  currency: string
  failureReason: string
  respondedAt: string
  createdAt: string
}

export function emptyUpsellStats(): UpsellStats {
  return { views: 0, accepted: 0, declined: 0, pending: 0, failed: 0, conversionRate: 0, revenue: 0, units: 0 }
}

export function emptyUpsellSummary(): UpsellSummary {
  return { total: 0, running: 0, views: 0, accepted: 0, declined: 0, conversionRate: 0, revenue: 0, units: 0, top: [] }
}

/** A JSON array of ids as numbers, ignoring anything else. */
export function parseIdList(raw: unknown): number[] {
  if (Array.isArray(raw))
    return [...new Set(raw.map(Number).filter(n => Number.isSafeInteger(n) && n > 0))]
  if (typeof raw !== 'string' || raw.trim() === '')
    return []
  try {
    return parseIdList(JSON.parse(raw))
  }
  catch {
    return []
  }
}

function day(value: unknown): string {
  const text = value == null ? '' : String(value).trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function whole(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function truthy(value: unknown): boolean {
  return value == null || value === true || value === 1 || String(value) === '1' || String(value) === 'true'
}

export function upsellState(row: Record<string, unknown>, now: string): UpsellState {
  if (!truthy(row.is_active))
    return 'disabled'
  if (row.starts_at && String(row.starts_at) > now)
    return 'scheduled'
  if (row.ends_at && String(row.ends_at) < now)
    return 'ended'
  return 'running'
}

/** One `post_purchase_offers` row as a record, given product names and its funnel. */
export function normalizeUpsellOfferRecord(
  row: Record<string, unknown>,
  now: string,
  productNames: ReadonlyMap<number, string>,
  stats: UpsellStats = emptyUpsellStats(),
): UpsellOfferRecord {
  const id = commerceIdentifier(commerceValue(row, 'id'), 'PostPurchaseOffer')
  const ref = (productId: number): UpsellProductRef => {
    const name = productNames.get(productId)
    return { id: String(productId), label: name ?? `Deleted product #${productId}`, exists: name !== undefined }
  }
  const minQuantity = Math.max(1, whole(row.min_quantity, 1))
  return {
    id,
    name: String(row.name ?? '').trim() || `Offer ${id}`,
    headline: String(row.headline ?? ''),
    message: String(row.message ?? ''),
    products: parseIdList(row.product_ids).map(ref),
    discountPercent: Math.min(100, Math.max(0, whole(row.discount_percent, 0))),
    minQuantity,
    defaultQuantity: Math.max(minQuantity, whole(row.default_quantity, minQuantity)),
    maxQuantity: row.max_quantity == null || row.max_quantity === '' ? null : whole(row.max_quantity, minQuantity),
    triggerProducts: parseIdList(row.trigger_product_ids).map(ref),
    minOrderTotal: row.min_order_total == null || row.min_order_total === '' ? null : whole(row.min_order_total, 0),
    windowMinutes: Math.max(1, whole(row.window_minutes, 30)),
    priority: whole(row.priority, 0),
    isActive: truthy(row.is_active),
    startsAt: day(row.starts_at),
    endsAt: day(row.ends_at),
    state: upsellState(row, now),
    stats,
    createdAt: commerceTimestamp(commerceValue(row, 'created_at', 'createdAt'), `PostPurchaseOffer ${id}`),
  }
}

/** Funnel counts from `(status, rows, amount, units)` groups of one offer's responses. */
export function statsFrom(groups: ReadonlyArray<{ status: string, rows: number, amount: number, units: number }>): UpsellStats {
  const stats = emptyUpsellStats()
  for (const group of groups) {
    stats.views += group.rows
    if (group.status === 'accepted') {
      stats.accepted += group.rows
      stats.revenue += group.amount
      stats.units += group.units
    }
    else if (group.status === 'declined') {
      stats.declined += group.rows
    }
    else if (group.status === 'pending') {
      stats.pending += group.rows
    }
    else if (group.status === 'failed') {
      stats.failed += group.rows
    }
  }
  stats.conversionRate = stats.views ? stats.accepted / stats.views : 0
  return stats
}

export interface UpsellWritePayload {
  name?: unknown
  headline?: unknown
  message?: unknown
  productIds?: unknown
  discountPercent?: unknown
  minQuantity?: unknown
  defaultQuantity?: unknown
  maxQuantity?: unknown
  triggerProductIds?: unknown
  minOrderTotal?: unknown
  windowMinutes?: unknown
  priority?: unknown
  isActive?: unknown
  startsAt?: unknown
  endsAt?: unknown
}

export type UpsellWriteResult =
  | { ok: true, data: Record<string, unknown>, productIds: number[] }
  | { ok: false, errors: Record<string, string> }

/** One week: longer than any post-purchase page stays open. */
const MAX_WINDOW_MINUTES = 7 * 24 * 60

function optionalWhole(value: unknown, field: string, errors: Record<string, string>, min: number, max = Number.MAX_SAFE_INTEGER): number | null {
  if (value === undefined || value === null || value === '')
    return null
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    errors[field] = max === Number.MAX_SAFE_INTEGER ? `must be a whole number of at least ${min}` : `must be a whole number from ${min} to ${max}`
    return null
  }
  return n
}

function dateColumn(value: unknown, field: string, endOfDay: boolean, errors: Record<string, string>): string | null {
  const text = value == null ? '' : String(value).trim()
  if (!text)
    return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    errors[field] = 'must be a date'
    return null
  }
  return `${text} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

/**
 * A dialog payload as the columns to write, or the field errors. The product
 * ids are returned too, for the caller to check they exist.
 */
export function upsellWriteData(payload: UpsellWritePayload): UpsellWriteResult {
  const errors: Record<string, string> = {}
  const name = String(payload.name ?? '').trim()
  if (!name)
    errors.name = 'is required'
  else if (name.length > 255)
    errors.name = 'must be 255 characters or fewer'

  const headline = String(payload.headline ?? '').trim()
  if (headline.length > 255)
    errors.headline = 'must be 255 characters or fewer'
  const message = String(payload.message ?? '').trim()
  if (message.length > 2000)
    errors.message = 'must be 2000 characters or fewer'

  const productIds = parseIdList(payload.productIds)
  if (productIds.length === 0)
    errors.productIds = 'choose at least one product to offer'
  else if (productIds.length > 12)
    errors.productIds = 'offer at most 12 products'

  const discountPercent = optionalWhole(payload.discountPercent, 'discountPercent', errors, 0, 100) ?? 0
  const minQuantity = optionalWhole(payload.minQuantity, 'minQuantity', errors, 1) ?? 1
  const defaultQuantity = optionalWhole(payload.defaultQuantity, 'defaultQuantity', errors, 1) ?? minQuantity
  const maxQuantity = optionalWhole(payload.maxQuantity, 'maxQuantity', errors, 1)
  if (!errors.defaultQuantity && defaultQuantity < minQuantity)
    errors.defaultQuantity = 'must be at least the minimum quantity'
  if (maxQuantity !== null && !errors.maxQuantity && maxQuantity < minQuantity)
    errors.maxQuantity = 'must be at least the minimum quantity'
  if (maxQuantity !== null && !errors.defaultQuantity && defaultQuantity > maxQuantity)
    errors.defaultQuantity = 'must be at most the maximum quantity'

  const windowMinutes = optionalWhole(payload.windowMinutes, 'windowMinutes', errors, 1, MAX_WINDOW_MINUTES) ?? 30
  const priority = payload.priority === undefined || payload.priority === null || payload.priority === '' ? 0 : Number(payload.priority)
  if (!Number.isSafeInteger(priority))
    errors.priority = 'must be a whole number'

  const startsAt = dateColumn(payload.startsAt, 'startsAt', false, errors)
  const endsAt = dateColumn(payload.endsAt, 'endsAt', true, errors)
  if (startsAt && endsAt && endsAt < startsAt)
    errors.endsAt = 'must be on or after the start date'

  const triggers = parseIdList(payload.triggerProductIds)
  const data = {
    name,
    headline: headline || null,
    message: message || null,
    product_ids: JSON.stringify(productIds),
    discount_percent: discountPercent,
    min_quantity: minQuantity,
    default_quantity: defaultQuantity,
    max_quantity: maxQuantity,
    trigger_product_ids: triggers.length ? JSON.stringify(triggers) : null,
    min_order_total: optionalWhole(payload.minOrderTotal, 'minOrderTotal', errors, 0),
    window_minutes: windowMinutes,
    priority: Number.isSafeInteger(priority) ? priority : 0,
    is_active: payload.isActive !== false,
    starts_at: startsAt,
    ends_at: endsAt,
  }

  if (Object.keys(errors).length > 0)
    return { ok: false, errors }
  return { ok: true, data, productIds: [...new Set([...productIds, ...triggers])] }
}
