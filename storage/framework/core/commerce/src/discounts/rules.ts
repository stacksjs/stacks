/**
 * Stored discount and coupon rows as engine rules. Pure, so a page that reads
 * its own rows (a server-rendered cart reading SQLite directly) prices with
 * exactly the rules the checkout uses: `@stacksjs/commerce/discounts/rules`.
 */

import type { DiscountRule, DiscountTarget, VolumeTier } from './engine'

/** Engine ids of stored rules: `discount:<id>` and `coupon:<id>`. */
export const DISCOUNT_PREFIX = 'discount:'
export const COUPON_PREFIX = 'coupon:'

/** A `discounts` row as the database returns it. */
export interface DiscountRow {
  id: number
  title: string
  code?: string | null
  type: string
  value?: number | string | null
  scope?: string | null
  per_item?: number | boolean | null
  target?: string | null
  buy_quantity?: number | null
  buy_target?: string | null
  get_quantity?: number | null
  get_target?: string | null
  get_percent?: number | string | null
  max_applications?: number | null
  tiers?: string | null
  max_shipping?: number | null
  minimum_subtotal?: number | null
  minimum_quantity?: number | null
  max_amount?: number | null
  combines_with_product?: number | boolean | null
  combines_with_order?: number | boolean | null
  combines_with_shipping?: number | boolean | null
  usage_limit?: number | null
  usage_count?: number | null
  is_active?: number | boolean | null
  starts_at?: string | null
  ends_at?: string | null
}

/** A `coupons` row as the database returns it. */
export interface CouponRow {
  id: number
  code: string
  description?: string | null
  is_active?: number | boolean | null
  discount_type: string
  discount_value: number | string
  min_order_amount?: number | string | null
  max_discount_amount?: number | string | null
  free_product_id?: number | string | null
  product_id?: number | null
  usage_limit?: number | string | null
  usage_count?: number | string | null
  start_date?: string | null
  end_date?: string | null
}

/** A `discounts` row as an engine rule. Its id is `discount:<id>`. */
export function ruleFromDiscount(row: DiscountRow): DiscountRule {
  const value = Number(row.value ?? 0)
  const base = {
    id: `${DISCOUNT_PREFIX}${row.id}`,
    title: row.title,
    code: row.code || null,
    target: parseTarget(row.target),
    scope: row.scope === 'product' || row.scope === 'order' ? row.scope : null,
    minimumSubtotal: numberOrNull(row.minimum_subtotal),
    minimumQuantity: numberOrNull(row.minimum_quantity),
    maxAmount: numberOrNull(row.max_amount),
    combinesWith: {
      product: truthy(row.combines_with_product),
      order: truthy(row.combines_with_order),
      shipping: truthy(row.combines_with_shipping),
    },
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active == null ? true : truthy(row.is_active),
    usageLimit: numberOrNull(row.usage_limit),
    usageCount: numberOrNull(row.usage_count),
  } satisfies Omit<DiscountRule, 'effect'>

  switch (row.type) {
    case 'percentage':
      return { ...base, effect: { type: 'percentage', percent: value } }
    case 'fixed_amount':
      return { ...base, effect: { type: 'fixed_amount', amount: Math.round(value), perItem: truthy(row.per_item) } }
    case 'buy_x_get_y':
      return {
        ...base,
        effect: {
          type: 'buy_x_get_y',
          buyQuantity: Number(row.buy_quantity ?? 1),
          buyTarget: parseTarget(row.buy_target),
          getQuantity: Number(row.get_quantity ?? 1),
          getTarget: parseTarget(row.get_target),
          getPercent: Number(row.get_percent ?? 100),
          maxApplications: numberOrNull(row.max_applications),
        },
      }
    case 'volume':
      return { ...base, effect: { type: 'volume', tiers: parseTiers(row.tiers) } }
    case 'free_shipping':
      return { ...base, effect: { type: 'free_shipping', maxShipping: numberOrNull(row.max_shipping) } }
    default:
      throw new TypeError(`Discount ${row.id} has unknown type "${row.type}".`)
  }
}

/**
 * A `coupons` row as an engine rule. Its id is `coupon:<id>`. A coupon tied to
 * a product discounts that product; one with a free product gives one unit of
 * it free once anything else is bought.
 */
export function ruleFromCoupon(row: CouponRow): DiscountRule {
  const value = Number(row.discount_value)
  const productId = numberOrNull(row.product_id)
  const freeProductId = numberOrNull(row.free_product_id)
  const base = {
    id: `${COUPON_PREFIX}${row.id}`,
    title: row.description || row.code,
    code: row.code,
    target: productId ? { productIds: [productId] } : null,
    minimumSubtotal: numberOrNull(row.min_order_amount),
    maxAmount: numberOrNull(row.max_discount_amount),
    startsAt: row.start_date ?? null,
    endsAt: row.end_date ? endOfDay(row.end_date) : null,
    isActive: row.is_active == null ? true : truthy(row.is_active),
    usageLimit: numberOrNull(row.usage_limit),
    usageCount: numberOrNull(row.usage_count),
  } satisfies Omit<DiscountRule, 'effect'>

  if (freeProductId) {
    return {
      ...base,
      target: null,
      effect: { type: 'buy_x_get_y', buyQuantity: 1, getQuantity: 1, getTarget: { productIds: [freeProductId] }, getPercent: 100, maxApplications: 1 },
    }
  }
  return row.discount_type === 'fixed_amount'
    ? { ...base, effect: { type: 'fixed_amount', amount: Math.round(value) } }
    : { ...base, effect: { type: 'percentage', percent: value } }
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (raw == null || raw === '')
    return null
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function parseTarget(raw: string | null | undefined): DiscountTarget | null {
  const parsed = parseJson<DiscountTarget>(raw)
  if (!parsed || typeof parsed !== 'object')
    return null
  const ids = (list: unknown) => Array.isArray(list) ? list.map(Number).filter(Number.isSafeInteger) : []
  return { productIds: ids(parsed.productIds), variantIds: ids(parsed.variantIds), categoryIds: ids(parsed.categoryIds) }
}

function parseTiers(raw: string | null | undefined): VolumeTier[] {
  const parsed = parseJson<unknown>(raw)
  if (!Array.isArray(parsed))
    return []
  return parsed
    .map(t => ({ minQuantity: Number((t as VolumeTier).minQuantity), percent: Number((t as VolumeTier).percent) }))
    .filter(t => Number.isFinite(t.minQuantity) && Number.isFinite(t.percent))
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '')
    return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/** A coupon's end date is a day; it stays valid through that whole day. */
function endOfDay(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59.999Z` : date
}
