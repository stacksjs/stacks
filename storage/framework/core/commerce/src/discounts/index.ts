/**
 * Discounts as a store keeps them: `discounts` rows (automatic or by code,
 * including buy X get Y, volume tiers and free shipping) and the older
 * `coupons`, priced through the pure engine in `./engine`.
 *
 * ```ts
 * import { discounts } from '@stacksjs/commerce'
 *
 * const priced = await discounts.price({ lines, codes: ['WELCOME10'], shipping: 500 })
 * priced.total          // what to charge, before tax
 * priced.applied        // what was applied, for the order and the receipt
 * priced.rejectedCodes  // why a code did nothing, for the checkout to say
 *
 * // Once the order is placed, count the uses. Atomic, limit enforced in SQL.
 * await discounts.redeemApplied(priced.applied)
 * ```
 */

import type { ApplyDiscountsInput, AppliedDiscount, DiscountResult, DiscountRule, DiscountTarget, VolumeTier } from './engine'
import type { CouponRow, DiscountRow } from './rules'
import { db, mutationCount, sqlHelpers } from '@stacksjs/database/runtime'
import { env } from '@stacksjs/env'
import { formatDate } from '@stacksjs/orm'
import { applyDiscounts } from './engine'
import { COUPON_PREFIX, DISCOUNT_PREFIX, ruleFromCoupon, ruleFromDiscount, truthy } from './rules'

export * from './engine'
export * from './rules'

export interface FetchRulesOptions {
  /** Codes the shopper entered; their discounts and coupons are loaded with the automatic ones. */
  codes?: readonly string[]
  /** Load matching coupons as well. Default true. */
  includeCoupons?: boolean
}

/**
 * The rules a basket could use: every active automatic discount, plus the
 * discounts and coupons whose codes were entered. The engine still checks
 * dates, limits and minimums; this only keeps the query small.
 */
export async function fetchRules(options: FetchRulesOptions = {}): Promise<DiscountRule[]> {
  const q = db as any
  const codes = [...new Set((options.codes ?? []).map(c => String(c).trim()).filter(Boolean))]
  const rules: DiscountRule[] = []

  const automatic = await q.selectFrom('discounts').where('code', 'is', null).selectAll().execute() as DiscountRow[]
  for (const row of automatic) {
    if (row.is_active == null || truthy(row.is_active))
      rules.push(ruleFromDiscount(row))
  }

  if (codes.length) {
    const wanted = new Set(codes.map(c => c.toUpperCase()))
    // Codes compare case-insensitively, which a plain `IN` does not do on every
    // dialect, so the candidates are narrowed in SQL and matched here.
    const coded = await q.selectFrom('discounts').where('code', 'is not', null).selectAll().execute() as DiscountRow[]
    for (const row of coded) {
      if (row.code && wanted.has(row.code.toUpperCase()))
        rules.push(ruleFromDiscount(row))
    }
    if (options.includeCoupons !== false) {
      const coupons = await q.selectFrom('coupons').selectAll().execute() as CouponRow[]
      for (const row of coupons) {
        if (row.code && wanted.has(row.code.toUpperCase()) && !rules.some(r => r.code?.toUpperCase() === row.code.toUpperCase()))
          rules.push(ruleFromCoupon(row))
      }
    }
  }

  return rules
}

export interface PriceInput extends Omit<ApplyDiscountsInput, 'rules'> {
  /** Rules to use instead of loading them. */
  rules?: readonly DiscountRule[]
  includeCoupons?: boolean
}

/** Price a basket against the store's discounts. */
export async function price(input: PriceInput): Promise<DiscountResult> {
  const rules = input.rules ?? await fetchRules({ codes: input.codes, includeCoupons: input.includeCoupons })
  return applyDiscounts({ ...input, rules })
}

export type RedeemOutcome =
  | { ruleId: string | number, ok: true }
  | { ruleId: string | number, ok: false, reason: 'limit-reached' | 'not-found' | 'inactive' | 'expired' | 'not-stored' }

/**
 * Count one use of every applied discount and coupon that came from the
 * database. Each is a single conditional UPDATE that enforces `usage_limit`,
 * so two checkouts racing for the last use cannot both get it; check the
 * outcomes and refuse the order (or drop the discount) when one did not.
 */
export async function redeemApplied(applied: readonly Pick<AppliedDiscount, 'ruleId'>[]): Promise<RedeemOutcome[]> {
  const outcomes: RedeemOutcome[] = []
  for (const { ruleId } of applied) {
    const key = String(ruleId)
    if (key.startsWith(DISCOUNT_PREFIX)) {
      const ok = await redeemDiscount(Number(key.slice(DISCOUNT_PREFIX.length)))
      outcomes.push(ok ? { ruleId, ok: true } : { ruleId, ok: false, reason: 'limit-reached' })
    }
    else if (key.startsWith(COUPON_PREFIX)) {
      const { redeem } = await import('../coupons/update')
      const result = await redeem(Number(key.slice(COUPON_PREFIX.length)))
      outcomes.push(result.ok ? { ruleId, ok: true } : { ruleId, ok: false, reason: result.reason })
    }
    else {
      outcomes.push({ ruleId, ok: false, reason: 'not-stored' })
    }
  }
  return outcomes
}

/** Count one use of a `discounts` row, refusing past its limit or outside its dates. */
export async function redeemDiscount(id: number): Promise<boolean> {
  const dialect = sqlHelpers(env.DB_CONNECTION || 'sqlite')
  const p = dialect.param
  const now = formatDate(new Date())
  const statement = await db.unsafe(
    `UPDATE discounts
    SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = ${p(1)}
    WHERE id = ${p(2)}
      AND (usage_limit IS NULL OR COALESCE(usage_count, 0) < usage_limit)
      AND (is_active IS NULL OR is_active = ${dialect.boolTrue})
      AND (starts_at IS NULL OR starts_at <= ${p(3)})
      AND (ends_at IS NULL OR ends_at >= ${p(4)})`,
    [now, id, now, now],
  )
  return mutationCount(statement) > 0
}

export interface NewDiscount {
  title: string
  code?: string | null
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'volume' | 'free_shipping'
  value?: number
  scope?: 'product' | 'order' | null
  perItem?: boolean
  target?: DiscountTarget | null
  buyQuantity?: number | null
  buyTarget?: DiscountTarget | null
  getQuantity?: number | null
  getTarget?: DiscountTarget | null
  getPercent?: number | null
  maxApplications?: number | null
  tiers?: readonly VolumeTier[] | null
  maxShipping?: number | null
  minimumSubtotal?: number | null
  minimumQuantity?: number | null
  maxAmount?: number | null
  combinesWith?: { product?: boolean, order?: boolean, shipping?: boolean }
  usageLimit?: number | null
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Create a discount. The rule is validated through the engine first, so a
 * discount that could not price a basket is refused here rather than at a
 * shopper's checkout.
 */
export async function store(input: NewDiscount): Promise<DiscountRow> {
  const q = db as any
  const { randomUUIDv7 } = await import('bun')
  const now = formatDate(new Date())
  const uuid = randomUUIDv7()
  const values = {
    uuid,
    title: input.title,
    code: input.code?.trim() || null,
    type: input.type,
    value: input.value ?? 0,
    scope: input.scope ?? null,
    per_item: Boolean(input.perItem),
    target: input.target ? JSON.stringify(input.target) : null,
    buy_quantity: input.buyQuantity ?? null,
    buy_target: input.buyTarget ? JSON.stringify(input.buyTarget) : null,
    get_quantity: input.getQuantity ?? null,
    get_target: input.getTarget ? JSON.stringify(input.getTarget) : null,
    get_percent: input.getPercent ?? null,
    max_applications: input.maxApplications ?? null,
    tiers: input.tiers ? JSON.stringify(input.tiers) : null,
    max_shipping: input.maxShipping ?? null,
    minimum_subtotal: input.minimumSubtotal ?? null,
    minimum_quantity: input.minimumQuantity ?? null,
    max_amount: input.maxAmount ?? null,
    combines_with_product: Boolean(input.combinesWith?.product),
    combines_with_order: Boolean(input.combinesWith?.order),
    combines_with_shipping: Boolean(input.combinesWith?.shipping),
    usage_limit: input.usageLimit ?? null,
    usage_count: 0,
    is_active: input.isActive ?? true,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    created_at: now,
    updated_at: now,
  }

  // Throws a TypeError naming the problem when the rule is unusable.
  applyDiscounts({ lines: [], rules: [ruleFromDiscount({ id: 0, ...values } as DiscountRow)] })

  await q.insertInto('discounts').values(values).execute()
  const row = await q.selectFrom('discounts').where('uuid', '=', uuid).selectAll().executeTakeFirst()
  if (!row)
    throw new Error('Discount insert could not be read back.')
  return row as DiscountRow
}

/** Every discount, newest first. */
export async function fetchAll(): Promise<DiscountRow[]> {
  return await (db as any).selectFrom('discounts').selectAll().orderBy('id', 'desc').execute() as DiscountRow[]
}

/** One discount by id. */
export async function fetchById(id: number): Promise<DiscountRow | undefined> {
  return await (db as any).selectFrom('discounts').where('id', '=', id).selectAll().executeTakeFirst() as DiscountRow | undefined
}

/** Switch a discount off. Answers whether a row changed. */
export async function deactivate(id: number): Promise<boolean> {
  const result = await (db as any)
    .updateTable('discounts')
    .set({ is_active: false, updated_at: formatDate(new Date()) })
    .where('id', '=', id)
    .executeTakeFirst()
  return mutationCount(result) > 0
}
