/**
 * The discount engine: which discounts a cart earns and what each line pays.
 *
 * Pure and synchronous, so the cart page, the checkout and the order that is
 * finally written all price a basket the same way, and a browser can bundle it
 * (`@stacksjs/commerce/discounts/engine`). Every amount is integer minor units
 * of one currency (1999 is $19.99), never a float.
 *
 * What it covers, in the terms a merchant uses:
 *
 * - **Automatic discounts** (no code) and **discount codes**, side by side.
 * - **Amount off products**: a percentage or a fixed amount off chosen
 *   products, variants or categories, per item or once across them.
 * - **Amount off order**: a percentage or fixed amount off the whole basket.
 * - **Buy X get Y**: "buy 4, get 4 free", "buy 2, get 1 at 50% off". The
 *   cheapest qualifying units are the ones discounted.
 * - **Volume tiers** (quantity breaks): "5+ pairs 20% off, 10+ pairs 30% off".
 * - **Free shipping**, optionally only on rates up to a ceiling.
 * - **Compare-at savings**: a sale price's "was" price counts toward the total
 *   a shopper is shown as saved, the way a storefront says "You saved $100".
 *
 * Combination follows the model shoppers already know from the big platforms:
 * every discount has a class (product, order or shipping), and two discounts
 * apply together only when each says it combines with the other's class. By
 * default nothing combines. A line takes at most one product discount; order
 * discounts apply to what is left after product discounts; shipping discounts
 * apply to the shipping fee.
 *
 * When discounts conflict, the one worth most on this basket wins: candidates
 * are evaluated alone, ranked by value, and taken greedily while they stay
 * compatible with everything already taken. A code that loses that contest is
 * reported in `rejectedCodes` with the reason, so a checkout can say why.
 */

export type DiscountClass = 'product' | 'order' | 'shipping'

/** Which lines a discount reaches. Leaving every list empty means every line. */
export interface DiscountTarget {
  productIds?: readonly number[] | null
  variantIds?: readonly number[] | null
  categoryIds?: readonly number[] | null
}

export interface VolumeTier {
  /** Units of the targeted lines, together, needed for this tier. */
  minQuantity: number
  /** Percent off each targeted line, 0 to 100. */
  percent: number
}

export type DiscountEffect =
  | { type: 'percentage', percent: number }
  /** `perItem`: the amount comes off every targeted unit, not once across them. */
  | { type: 'fixed_amount', amount: number, perItem?: boolean }
  | {
    type: 'buy_x_get_y'
    buyQuantity: number
    /** What has to be bought. Defaults to the rule's `target`. */
    buyTarget?: DiscountTarget | null
    getQuantity: number
    /** What comes discounted. Defaults to `buyTarget`, then the rule's `target`. */
    getTarget?: DiscountTarget | null
    /** Percent off each "get" unit: 100 is free. */
    getPercent: number
    /** How many times one order may use it. Unlimited when left out. */
    maxApplications?: number | null
  }
  | { type: 'volume', tiers: readonly VolumeTier[] }
  /** Free shipping, only when the rate is at most `maxShipping` if one is set. */
  | { type: 'free_shipping', maxShipping?: number | null }

export interface DiscountRule {
  id: string | number
  /** What the shopper sees next to the saving: "BUY 4, GET 4 FREE | 50% OFF". */
  title: string
  /** The code a shopper types. Null or absent makes the discount automatic. */
  code?: string | null
  effect: DiscountEffect
  /** The lines a product discount reaches. Ignored by order and shipping discounts. */
  target?: DiscountTarget | null
  /**
   * For `percentage` and `fixed_amount`: `product` discounts the targeted
   * lines, `order` discounts the basket. Defaults to `product` when a target
   * names something and `order` when it does not.
   */
  scope?: 'product' | 'order' | null
  /** Subtotal, before discounts, the discount needs: of its targeted lines for a product discount, of the basket otherwise. */
  minimumSubtotal?: number | null
  /** Units the discount needs, counted the same way as `minimumSubtotal`. */
  minimumQuantity?: number | null
  /** The most this discount takes off one order. */
  maxAmount?: number | null
  /** The classes it may be combined with. Nothing, unless said. */
  combinesWith?: Partial<Record<DiscountClass, boolean>> | null
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  isActive?: boolean | null
  usageLimit?: number | null
  usageCount?: number | null
}

export interface DiscountLineInput {
  id: string | number
  productId: number
  variantId?: number | null
  categoryId?: number | null
  quantity: number
  /** What one unit sells for, before any discount. */
  unitPrice: number
  /** The struck-through "was" price of one unit, when the item is on sale. */
  compareAtPrice?: number | null
}

export interface ApplyDiscountsInput {
  lines: readonly DiscountLineInput[]
  rules: readonly DiscountRule[]
  /** Codes the shopper entered. Matched case-insensitively. */
  codes?: readonly string[]
  /** The shipping fee before discounts. */
  shipping?: number
  now?: Date
}

export interface DiscountAllocation {
  ruleId: string | number
  amount: number
}

export interface DiscountedLine {
  id: string | number
  quantity: number
  unitPrice: number
  /** `unitPrice * quantity`. */
  subtotal: number
  /** What the line would cost at its compare-at price, or `subtotal` when it has none. */
  compareAtSubtotal: number
  /** Product and order discounts on this line together. */
  discount: number
  /** `subtotal - discount`. */
  total: number
  /** Which discount took what. Order discounts are spread across lines so a refund of one line returns its share. */
  allocations: DiscountAllocation[]
}

export interface AppliedDiscount {
  ruleId: string | number
  title: string
  code: string | null
  class: DiscountClass
  amount: number
}

export type RejectedCodeReason =
  | 'not-found'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'requirements-not-met'
  | 'no-eligible-items'
  | 'not-combinable'

export interface RejectedCode {
  code: string
  reason: RejectedCodeReason
}

export interface DiscountResult {
  lines: DiscountedLine[]
  applied: AppliedDiscount[]
  rejectedCodes: RejectedCode[]
  /** Sum of line subtotals. */
  subtotal: number
  productDiscount: number
  orderDiscount: number
  shippingDiscount: number
  /** Product plus order discounts: what comes off the merchandise. */
  discount: number
  /** `subtotal - discount`. */
  discountedSubtotal: number
  shipping: number
  shippingAfterDiscount: number
  /** `discountedSubtotal + shippingAfterDiscount`, before tax. */
  total: number
  /** Saved against compare-at prices. */
  compareAtSavings: number
  /** Everything the shopper saved: compare-at, product, order and shipping. */
  totalSavings: number
}

interface LineState {
  input: DiscountLineInput
  subtotal: number
  remaining: number
  productDiscounted: boolean
  allocations: DiscountAllocation[]
}

interface Evaluation {
  /** Per line index, what this rule takes. */
  perLine: Map<number, number>
  shipping: number
  /** Why it took nothing, when it took nothing. */
  shortfall?: 'requirements-not-met' | 'no-eligible-items'
}

const NO_COMBINATION: Record<DiscountClass, boolean> = { product: false, order: false, shipping: false }

/** The class a rule belongs to, from its effect, scope and target. */
export function discountClass(rule: Pick<DiscountRule, 'effect' | 'scope' | 'target'>): DiscountClass {
  switch (rule.effect.type) {
    case 'free_shipping':
      return 'shipping'
    case 'buy_x_get_y':
    case 'volume':
      return 'product'
    default:
      if (rule.scope)
        return rule.scope
      return hasTarget(rule.target) ? 'product' : 'order'
  }
}

/** True when a rule can be used at `now`: active, started, not ended, not used up. */
export function isDiscountAvailable(rule: DiscountRule, now: Date = new Date()): boolean {
  return availability(rule, now) === 'ok'
}

function availability(rule: DiscountRule, now: Date): 'ok' | 'inactive' | 'expired' | 'exhausted' {
  if (rule.isActive === false)
    return 'inactive'
  const starts = toTime(rule.startsAt)
  const ends = toTime(rule.endsAt)
  if (starts !== null && now.getTime() < starts)
    return 'inactive'
  if (ends !== null && now.getTime() > ends)
    return 'expired'
  if (rule.usageLimit != null && Number(rule.usageCount ?? 0) >= Number(rule.usageLimit))
    return 'exhausted'
  return 'ok'
}

/** Whether a line falls inside a target. An empty target holds every line. */
export function matchesTarget(line: Pick<DiscountLineInput, 'productId' | 'variantId' | 'categoryId'>, target?: DiscountTarget | null): boolean {
  if (!hasTarget(target))
    return true
  const t = target!
  if (t.variantIds?.length && line.variantId != null && t.variantIds.includes(line.variantId))
    return true
  if (t.productIds?.length && t.productIds.includes(line.productId))
    return true
  if (t.categoryIds?.length && line.categoryId != null && t.categoryIds.includes(line.categoryId))
    return true
  return false
}

/**
 * Whether two discounts may apply to one order. Each has to accept the
 * other's class; two discounts of one class both have to accept that class.
 */
export function canCombine(a: DiscountRule, b: DiscountRule): boolean {
  const aClass = discountClass(a)
  const bClass = discountClass(b)
  const aWith = { ...NO_COMBINATION, ...(a.combinesWith ?? {}) }
  const bWith = { ...NO_COMBINATION, ...(b.combinesWith ?? {}) }
  return Boolean(aWith[bClass]) && Boolean(bWith[aClass])
}

/**
 * A short label for a discount, for a badge or a line under the item:
 * `BUY 4, GET 4 FREE`, `20% OFF`, `5+ FOR 30% OFF`, `FREE SHIPPING`.
 * `formatAmount` renders a fixed amount; without it the minor units show.
 */
export function discountLabel(rule: Pick<DiscountRule, 'effect'>, formatAmount: (minor: number) => string = String): string {
  const e = rule.effect
  switch (e.type) {
    case 'percentage':
      return `${trimPercent(e.percent)}% OFF`
    case 'fixed_amount':
      return `${formatAmount(e.amount)} OFF${e.perItem ? ' EACH' : ''}`
    case 'buy_x_get_y':
      return `BUY ${e.buyQuantity}, GET ${e.getQuantity} ${e.getPercent >= 100 ? 'FREE' : `${trimPercent(e.getPercent)}% OFF`}`
    case 'volume': {
      const tiers = [...e.tiers].sort((x, y) => x.minQuantity - y.minQuantity)
      return tiers.map(t => `${t.minQuantity}+ FOR ${trimPercent(t.percent)}% OFF`).join(', ')
    }
    case 'free_shipping':
      return 'FREE SHIPPING'
  }
}

/** Price a basket: choose its discounts and spread them over its lines. */
export function applyDiscounts(input: ApplyDiscountsInput): DiscountResult {
  const now = input.now ?? new Date()
  const shipping = assertMinor(input.shipping ?? 0, 'shipping')
  const lines: LineState[] = input.lines.map((line, i): LineState => {
    assertLine(line, i)
    const subtotal = line.unitPrice * line.quantity
    return { input: line, subtotal, remaining: subtotal, productDiscounted: false, allocations: [] }
  })

  for (const rule of input.rules)
    assertRule(rule)

  const rejectedCodes: RejectedCode[] = []
  const entered = dedupeCodes(input.codes ?? [])
  const candidates: DiscountRule[] = []

  for (const rule of input.rules) {
    if (!rule.code && availability(rule, now) === 'ok')
      candidates.push(rule)
  }

  for (const code of entered) {
    const rule = input.rules.find(r => r.code && normalizeCode(r.code) === normalizeCode(code))
    if (!rule) {
      rejectedCodes.push({ code, reason: 'not-found' })
      continue
    }
    const state = availability(rule, now)
    if (state !== 'ok') {
      rejectedCodes.push({ code, reason: state })
      continue
    }
    candidates.push(rule)
  }

  // Each candidate alone against the untouched basket, to rank them.
  const standalone = candidates.map((rule) => {
    const evaluation = evaluate(rule, lines, shipping, 0)
    return { rule, evaluation, value: sumEvaluation(evaluation) }
  })

  for (const { rule, evaluation, value } of standalone) {
    if (value === 0 && rule.code)
      rejectedCodes.push({ code: rule.code, reason: evaluation.shortfall ?? 'no-eligible-items' })
  }

  const ranked = standalone
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value || Number(Boolean(a.rule.code)) - Number(Boolean(b.rule.code)))

  const chosen: DiscountRule[] = []
  for (const { rule } of ranked) {
    if (chosen.every(other => canCombine(rule, other)))
      chosen.push(rule)
    else if (rule.code)
      rejectedCodes.push({ code: rule.code, reason: 'not-combinable' })
  }

  // Apply for real: product discounts first (best first), then order, then shipping.
  const order: Record<DiscountClass, number> = { product: 0, order: 1, shipping: 2 }
  const valueOf = new Map(ranked.map(c => [c.rule, c.value]))
  chosen.sort((a, b) => order[discountClass(a)] - order[discountClass(b)] || (valueOf.get(b) ?? 0) - (valueOf.get(a) ?? 0))

  const applied: AppliedDiscount[] = []
  let shippingDiscount = 0
  let productDiscount = 0
  let orderDiscount = 0

  // A line takes one product discount: the one worth most on that line. Each
  // product discount is then priced again on the lines it won, since a
  // threshold or a "buy" quantity can depend on which lines it keeps.
  const standaloneOf = new Map(standalone.map(c => [c.rule, c.evaluation]))
  const owner = new Map<number, DiscountRule>()
  for (const rule of chosen) {
    if (discountClass(rule) !== 'product')
      continue
    for (const [index, take] of standaloneOf.get(rule)?.perLine ?? []) {
      const current = owner.get(index)
      const currentTake = current ? standaloneOf.get(current)?.perLine.get(index) ?? 0 : 0
      if (take > currentTake)
        owner.set(index, rule)
    }
  }

  for (const rule of chosen) {
    const cls = discountClass(rule)
    const view = cls === 'product'
      ? lines.map((l, i) => ({ ...l, productDiscounted: l.productDiscounted || (owner.has(i) && owner.get(i) !== rule) }))
      : lines
    const evaluation = evaluate(rule, view, shipping, shippingDiscount)
    const amount = sumEvaluation(evaluation)
    if (amount === 0) {
      if (rule.code)
        rejectedCodes.push({ code: rule.code, reason: 'not-combinable' })
      continue
    }

    for (const [index, take] of evaluation.perLine) {
      if (take <= 0)
        continue
      const line = lines[index]!
      line.remaining -= take
      line.allocations.push({ ruleId: rule.id, amount: take })
      if (cls === 'product')
        line.productDiscounted = true
    }
    shippingDiscount += evaluation.shipping
    if (cls === 'product')
      productDiscount += amount
    else if (cls === 'order')
      orderDiscount += amount

    applied.push({ ruleId: rule.id, title: rule.title, code: rule.code ?? null, class: cls, amount })
  }

  const outLines: DiscountedLine[] = lines.map((line) => {
    const discount = line.subtotal - line.remaining
    const compareAt = line.input.compareAtPrice != null && line.input.compareAtPrice > line.input.unitPrice
      ? line.input.compareAtPrice * line.input.quantity
      : line.subtotal
    return {
      id: line.input.id,
      quantity: line.input.quantity,
      unitPrice: line.input.unitPrice,
      subtotal: line.subtotal,
      compareAtSubtotal: compareAt,
      discount,
      total: line.remaining,
      allocations: line.allocations,
    }
  })

  const subtotal = outLines.reduce((s, l) => s + l.subtotal, 0)
  const discount = productDiscount + orderDiscount
  const discountedSubtotal = subtotal - discount
  const shippingAfterDiscount = shipping - shippingDiscount
  const compareAtSavings = outLines.reduce((s, l) => s + (l.compareAtSubtotal - l.subtotal), 0)

  return {
    lines: outLines,
    applied,
    rejectedCodes,
    subtotal,
    productDiscount,
    orderDiscount,
    shippingDiscount,
    discount,
    discountedSubtotal,
    shipping,
    shippingAfterDiscount,
    total: discountedSubtotal + shippingAfterDiscount,
    compareAtSavings,
    totalSavings: compareAtSavings + discount + shippingDiscount,
  }
}

function evaluate(rule: DiscountRule, lines: readonly LineState[], shipping: number, shippingDiscounted: number): Evaluation {
  const cls = discountClass(rule)
  const perLine = new Map<number, number>()

  if (cls === 'shipping') {
    if (!meetsMinimums(rule, lines.map((_, i) => i), lines))
      return { perLine, shipping: 0, shortfall: 'requirements-not-met' }
    const effect = rule.effect as Extract<DiscountEffect, { type: 'free_shipping' }>
    const left = shipping - shippingDiscounted
    if (left <= 0 || (effect.maxShipping != null && shipping > effect.maxShipping))
      return { perLine, shipping: 0, shortfall: 'no-eligible-items' }
    return { perLine, shipping: capTotal(left, rule.maxAmount) }
  }

  if (cls === 'order') {
    const all = lines.map((_, i) => i)
    if (!meetsMinimums(rule, all, lines))
      return { perLine, shipping: 0, shortfall: 'requirements-not-met' }
    const base = lines.reduce((s, l) => s + l.remaining, 0)
    if (base <= 0)
      return { perLine, shipping: 0, shortfall: 'no-eligible-items' }
    const effect = rule.effect as Extract<DiscountEffect, { type: 'percentage' | 'fixed_amount' }>
    const total = capTotal(
      Math.min(base, effect.type === 'percentage' ? percentOf(base, effect.percent) : effect.amount),
      rule.maxAmount,
    )
    const shares = allocate(total, lines.map(l => l.remaining))
    shares.forEach((share, i) => share > 0 && perLine.set(i, share))
    return { perLine, shipping: 0 }
  }

  // Product class: lines in the target, not already carrying a product discount.
  const eligible = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !l.productDiscounted && l.remaining > 0)

  const effect = rule.effect
  if (effect.type === 'buy_x_get_y')
    return buyXGetY(rule, effect, eligible, lines)

  const targeted = eligible.filter(({ l }) => matchesTarget(l.input, rule.target))
  if (targeted.length === 0)
    return { perLine, shipping: 0, shortfall: 'no-eligible-items' }
  if (!meetsMinimums(rule, targeted.map(t => t.i), lines))
    return { perLine, shipping: 0, shortfall: 'requirements-not-met' }

  if (effect.type === 'percentage') {
    for (const { l, i } of targeted)
      perLine.set(i, Math.min(l.remaining, percentOf(l.remaining, effect.percent)))
  }
  else if (effect.type === 'volume') {
    const units = targeted.reduce((s, t) => s + t.l.input.quantity, 0)
    const tier = [...effect.tiers]
      .sort((a, b) => b.minQuantity - a.minQuantity)
      .find(t => units >= t.minQuantity)
    if (!tier)
      return { perLine, shipping: 0, shortfall: 'requirements-not-met' }
    for (const { l, i } of targeted)
      perLine.set(i, Math.min(l.remaining, percentOf(l.remaining, tier.percent)))
  }
  else if (effect.type === 'fixed_amount') {
    if (effect.perItem) {
      for (const { l, i } of targeted)
        perLine.set(i, Math.min(l.remaining, effect.amount * l.input.quantity))
    }
    else {
      const base = targeted.reduce((s, t) => s + t.l.remaining, 0)
      const shares = allocate(Math.min(base, effect.amount), targeted.map(t => t.l.remaining))
      targeted.forEach(({ i }, k) => shares[k]! > 0 && perLine.set(i, shares[k]!))
    }
  }

  return capEvaluation({ perLine, shipping: 0 }, rule.maxAmount, lines)
}

/**
 * Buy X get Y over individual units. Each pass takes the `buyQuantity` dearest
 * qualifying units as the purchase and the `getQuantity` cheapest remaining
 * qualifying units as the reward, so a shopper is never handed the saving on
 * the expensive item while paying for the cheap one. A pass that finds fewer
 * "get" units than promised discounts the ones there are; a pass that finds
 * none ends the loop without spending its "buy" units.
 */
function buyXGetY(
  rule: DiscountRule,
  effect: Extract<DiscountEffect, { type: 'buy_x_get_y' }>,
  eligible: ReadonlyArray<{ l: LineState, i: number }>,
  lines: readonly LineState[],
): Evaluation {
  const perLine = new Map<number, number>()
  const buyTarget = effect.buyTarget ?? rule.target
  const getTarget = effect.getTarget ?? buyTarget

  interface Unit { line: number, price: number, buy: boolean, get: boolean, used: boolean }
  const units: Unit[] = []
  for (const { l, i } of eligible) {
    const buy = matchesTarget(l.input, buyTarget)
    const get = matchesTarget(l.input, getTarget)
    if (!buy && !get)
      continue
    for (let n = 0; n < l.input.quantity; n++)
      units.push({ line: i, price: l.input.unitPrice, buy, get, used: false })
  }

  const buyLines = [...new Set(units.filter(u => u.buy).map(u => u.line))]
  if (buyLines.length === 0)
    return { perLine, shipping: 0, shortfall: 'no-eligible-items' }
  if (!meetsMinimums(rule, buyLines, lines))
    return { perLine, shipping: 0, shortfall: 'requirements-not-met' }

  const byPriceDesc = [...units].sort((a, b) => b.price - a.price)
  const byPriceAsc = [...units].sort((a, b) => a.price - b.price)
  const limit = effect.maxApplications ?? Number.POSITIVE_INFINITY
  let applications = 0

  while (applications < limit) {
    const buys = byPriceDesc.filter(u => u.buy && !u.used).slice(0, effect.buyQuantity)
    if (buys.length < effect.buyQuantity)
      break
    for (const u of buys) u.used = true
    const gets = byPriceAsc.filter(u => u.get && !u.used).slice(0, effect.getQuantity)
    if (gets.length === 0) {
      for (const u of buys) u.used = false
      break
    }
    for (const u of gets) {
      u.used = true
      perLine.set(u.line, (perLine.get(u.line) ?? 0) + percentOf(u.price, effect.getPercent))
    }
    applications++
  }

  if (perLine.size === 0)
    return { perLine, shipping: 0, shortfall: 'requirements-not-met' }

  for (const [i, take] of perLine)
    perLine.set(i, Math.min(take, lines[i]!.remaining))

  return capEvaluation({ perLine, shipping: 0 }, rule.maxAmount, lines)
}

function meetsMinimums(rule: DiscountRule, indexes: readonly number[], lines: readonly LineState[]): boolean {
  if (rule.minimumSubtotal != null && rule.minimumSubtotal > 0) {
    const subtotal = indexes.reduce((s, i) => s + lines[i]!.subtotal, 0)
    if (subtotal < rule.minimumSubtotal)
      return false
  }
  if (rule.minimumQuantity != null && rule.minimumQuantity > 0) {
    const quantity = indexes.reduce((s, i) => s + lines[i]!.input.quantity, 0)
    if (quantity < rule.minimumQuantity)
      return false
  }
  return true
}

function capEvaluation(evaluation: Evaluation, maxAmount: number | null | undefined, _lines: readonly LineState[]): Evaluation {
  const total = sumEvaluation(evaluation)
  if (maxAmount == null || total <= maxAmount)
    return evaluation
  const indexes = [...evaluation.perLine.keys()]
  const shares = allocate(maxAmount, indexes.map(i => evaluation.perLine.get(i)!))
  const perLine = new Map<number, number>()
  indexes.forEach((i, k) => shares[k]! > 0 && perLine.set(i, shares[k]!))
  return { perLine, shipping: evaluation.shipping }
}

function capTotal(amount: number, maxAmount: number | null | undefined): number {
  return maxAmount == null ? amount : Math.min(amount, maxAmount)
}

function sumEvaluation(evaluation: Evaluation): number {
  let total = evaluation.shipping
  for (const take of evaluation.perLine.values())
    total += take
  return total
}

/**
 * Split `total` across `weights` in proportion, in whole minor units, by the
 * largest-remainder method: the parts always add up to `total` exactly and no
 * part exceeds its weight.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (total <= 0 || sum <= 0)
    return weights.map(() => 0)
  const amount = Math.min(total, sum)
  const raw = weights.map(w => (Math.max(0, w) * amount) / sum)
  const parts = raw.map(Math.floor)
  let left = amount - parts.reduce((s, p) => s + p, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0)
      break
    if (parts[i]! < Math.max(0, weights[i]!)) {
      parts[i]!++
      left--
    }
  }
  return parts
}

/** `percent` of an amount in minor units, rounded half up. */
export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100)
}

function hasTarget(target?: DiscountTarget | null): boolean {
  return Boolean(target && (target.productIds?.length || target.variantIds?.length || target.categoryIds?.length))
}

function toTime(value: string | Date | null | undefined): number | null {
  if (value == null || value === '')
    return null
  const time = value instanceof Date ? value.getTime() : Date.parse(asUtc(String(value)))
  return Number.isFinite(time) ? time : null
}

/**
 * Timestamps are stored as `YYYY-MM-DD HH:MM:SS` in UTC (`formatDate`), with
 * no zone. `Date.parse` would read that as local time and move every window
 * by the server's offset, so a zone-less date-time is read as UTC.
 */
function asUtc(value: string): string {
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

function dedupeCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const code of codes) {
    const key = normalizeCode(String(code ?? ''))
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(String(code).trim())
    }
  }
  return out
}

function trimPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, '')
}

function assertMinor(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${name} must be a non-negative whole number of minor units, got ${value}.`)
  return value
}

function assertPercent(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new TypeError(`${name} must be a percentage from 0 to 100, got ${value}.`)
}

function assertLine(line: DiscountLineInput, index: number): void {
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0)
    throw new TypeError(`Line ${index} quantity must be a positive whole number, got ${line.quantity}.`)
  assertMinor(line.unitPrice, `Line ${index} unitPrice`)
  if (line.compareAtPrice != null)
    assertMinor(line.compareAtPrice, `Line ${index} compareAtPrice`)
}

function assertRule(rule: DiscountRule): void {
  const e = rule.effect
  const name = `Discount ${String(rule.id)}`
  switch (e.type) {
    case 'percentage':
      assertPercent(e.percent, `${name} percent`)
      break
    case 'fixed_amount':
      assertMinor(e.amount, `${name} amount`)
      break
    case 'buy_x_get_y':
      if (!Number.isSafeInteger(e.buyQuantity) || e.buyQuantity < 1)
        throw new TypeError(`${name} buyQuantity must be a whole number of at least 1.`)
      if (!Number.isSafeInteger(e.getQuantity) || e.getQuantity < 1)
        throw new TypeError(`${name} getQuantity must be a whole number of at least 1.`)
      assertPercent(e.getPercent, `${name} getPercent`)
      if (e.maxApplications != null && (!Number.isSafeInteger(e.maxApplications) || e.maxApplications < 1))
        throw new TypeError(`${name} maxApplications must be a whole number of at least 1.`)
      break
    case 'volume':
      if (!e.tiers.length)
        throw new TypeError(`${name} needs at least one tier.`)
      for (const tier of e.tiers) {
        if (!Number.isSafeInteger(tier.minQuantity) || tier.minQuantity < 1)
          throw new TypeError(`${name} tier minQuantity must be a whole number of at least 1.`)
        assertPercent(tier.percent, `${name} tier percent`)
      }
      break
    case 'free_shipping':
      if (e.maxShipping != null)
        assertMinor(e.maxShipping, `${name} maxShipping`)
      break
    default:
      throw new TypeError(`${name} has an unknown effect type.`)
  }
  if (rule.maxAmount != null)
    assertMinor(rule.maxAmount, `${name} maxAmount`)
}
