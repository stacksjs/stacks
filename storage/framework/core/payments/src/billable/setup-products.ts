import type Stripe from 'stripe'
import type { SaasCoupon } from '@stacksjs/types'
import type { Result } from '@stacksjs/error-handling'
import { saas } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'
import { findManagedPortalConfiguration, portalConfigurationMatches, portalConfigurationParams } from './portal'

interface PriceParams {
  unit_amount: number
  currency: string
  product: string
  lookup_key: string
  transfer_lookup_key?: boolean
  recurring?: {
    interval: 'day' | 'month' | 'week' | 'year'
  }
}

export interface SetupProductsOptions {
  /** Report what would change and write nothing. */
  dryRun?: boolean
}

/** One line of the plan of record, in the order it would be applied. */
export interface SetupProductAction {
  kind: 'product' | 'price' | 'coupon' | 'promotion-code' | 'portal'
  /**
   * `create` writes a new object, `reuse` found an equivalent one, `replace`
   * moves a lookup key onto a new price, `update` edits one in place (the
   * portal), and `conflict` found an object that differs from the config and
   * cannot be changed - it is reported, never overwritten.
   */
  verb: 'create' | 'reuse' | 'replace' | 'update' | 'conflict'
  /** Product name, price lookup key, coupon id, promotion code, or the portal. */
  target: string
  detail?: string
}

export interface SetupProductsReport {
  dryRun: boolean
  actions: SetupProductAction[]
}

/**
 * Find the active product a plan maps to.
 *
 * Matched by name rather than through `products.search`. Search is the obvious
 * tool and the wrong one here: its index is eventually consistent (Stripe
 * documents a lag of up to a minute), so a second run inside that window would
 * find nothing and create a duplicate — reintroducing the exact bug this
 * lookup exists to prevent. `products.list` reads the live objects.
 */
async function findProductByName(name: string): Promise<Stripe.Product | undefined> {
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.name === name)
      return product
  }
  return undefined
}

/** The active price carrying `lookupKey`, if one exists. A lookup key belongs to at most one price. */
async function findPriceByLookupKey(lookupKey: string): Promise<Stripe.Price | undefined> {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  return prices.data[0]
}

/** True when the live price already encodes exactly what the config asks for. */
function priceMatches(price: Stripe.Price, params: PriceParams): boolean {
  return price.unit_amount === params.unit_amount
    && price.currency === params.currency
    && price.product === params.product
    && (price.recurring?.interval ?? undefined) === params.recurring?.interval
}

/**
 * Provision the products and prices declared in `config/saas.ts`.
 *
 * Idempotent by construction, because this is a command people re-run: a second
 * environment, a price change, an added plan, an unguarded CI step. The previous
 * implementation created unconditionally, so a second run left a duplicate
 * product behind and then failed on `prices.create` — a lookup key may only
 * belong to one active price — exiting non-zero having half-applied
 * (stacksjs/stacks#2359).
 *
 * Stripe prices are immutable, so a changed amount cannot be edited in place.
 * The lookup key is moved onto a new price with `transfer_lookup_key`, which
 * Stripe applies atomically, and the superseded price is left active but
 * unkeyed so existing subscriptions on it keep billing.
 */
export async function createStripeProduct(options: SetupProductsOptions = {}): Promise<Result<SetupProductsReport, Error>> {
  const dryRun = options.dryRun ?? false
  const actions: SetupProductAction[] = []
  const plans = saas.plans ?? []
  // Product ids by plan name, for coupons that apply to some plans only.
  const productIds = new Map<string, string>()

  try {
    if (!plans.length && !saas.coupons?.length && !saas.portal)
      return ok({ dryRun, actions })

    for (const plan of plans) {
      const existingProduct = await findProductByName(plan.productName)
      let productId = existingProduct?.id

      if (existingProduct) {
        actions.push({ kind: 'product', verb: 'reuse', target: plan.productName, detail: existingProduct.id })
      }
      else {
        actions.push({ kind: 'product', verb: 'create', target: plan.productName })
        if (!dryRun) {
          const product = await stripe.products.create({
            name: plan.productName,
            description: plan.description,
            metadata: plan.metadata,
          })
          productId = product.id
        }
      }
      if (productId)
        productIds.set(plan.productName, productId)

      for (const pricing of plan.pricing) {
        // On a dry run against a product that does not exist yet there is no id
        // to compare against, so report the price as a create and move on rather
        // than inventing one.
        if (!productId) {
          actions.push({ kind: 'price', verb: 'create', target: pricing.key })
          continue
        }

        const priceParams: PriceParams = {
          unit_amount: pricing.price,
          currency: pricing.currency,
          product: productId,
          lookup_key: pricing.key,
        }
        if (pricing.interval)
          priceParams.recurring = { interval: pricing.interval }

        const existingPrice = await findPriceByLookupKey(pricing.key)

        if (existingPrice && priceMatches(existingPrice, priceParams)) {
          actions.push({ kind: 'price', verb: 'reuse', target: pricing.key, detail: existingPrice.id })
          continue
        }

        if (existingPrice) {
          actions.push({
            kind: 'price',
            verb: 'replace',
            target: pricing.key,
            detail: `${existingPrice.id} -> new price (${pricing.price} ${pricing.currency})`,
          })
          priceParams.transfer_lookup_key = true
        }
        else {
          actions.push({ kind: 'price', verb: 'create', target: pricing.key })
        }

        if (!dryRun)
          await stripe.prices.create(priceParams)
      }
    }

    for (const coupon of saas.coupons ?? [])
      await reconcileCoupon(coupon, productIds, dryRun, actions)

    if (saas.portal)
      await reconcilePortal(dryRun, actions)

    return ok({ dryRun, actions })
  }
  catch (error) {
    const e = error instanceof Error ? error : new Error(String(error))
    log.error(e)

    return err(e)
  }
}

/** A coupon by id, or undefined when the account has none by that id. */
async function findCoupon(id: string): Promise<Stripe.Coupon | undefined> {
  try {
    const coupon = await stripe.coupons.retrieve(id)
    return coupon.deleted ? undefined : coupon
  }
  catch (error) {
    if ((error as { statusCode?: number, code?: string }).statusCode === 404 || (error as { code?: string }).code === 'resource_missing')
      return undefined
    throw error
  }
}

/** The coupon a promotion code points at, as an id. */
function promotionCouponId(promotion: Stripe.PromotionCode): string | undefined {
  const coupon = promotion.promotion?.coupon
  return typeof coupon === 'string' ? coupon : coupon?.id
}

/** True when the live coupon is the discount the config describes. */
function couponMatches(live: Stripe.Coupon, want: SaasCoupon): boolean {
  return (live.percent_off ?? undefined) === want.percentOff
    && (live.amount_off ?? undefined) === want.amountOff
    && live.duration === want.duration
    && (live.duration_in_months ?? undefined) === (want.duration === 'repeating' ? want.durationInMonths : undefined)
}

/**
 * One coupon and its codes. A coupon is immutable in Stripe, so one that
 * exists but differs is reported as a conflict rather than deleted and
 * re-made: codes already handed out point at it, and deleting it would void
 * them. Changing a discount is a new coupon `id`.
 */
async function reconcileCoupon(coupon: SaasCoupon, productIds: Map<string, string>, dryRun: boolean, actions: SetupProductAction[]): Promise<void> {
  const id = coupon.id ?? coupon.code
  if (!id) {
    actions.push({ kind: 'coupon', verb: 'conflict', target: '(unnamed)', detail: 'a coupon needs an id or a code' })
    return
  }

  const live = await findCoupon(id)
  if (live && !couponMatches(live, coupon)) {
    actions.push({ kind: 'coupon', verb: 'conflict', target: id, detail: 'exists with a different discount; coupons cannot change, so give this one a new id' })
    return
  }

  if (live) {
    actions.push({ kind: 'coupon', verb: 'reuse', target: id })
  }
  else {
    const products = (coupon.appliesTo ?? []).map(name => productIds.get(name))
    const unresolved = (coupon.appliesTo ?? []).filter((_name, index) => !products[index])
    // A restriction that names a product this run cannot resolve would create
    // a coupon for every product instead - the opposite of what was asked.
    if (unresolved.length && !dryRun) {
      actions.push({ kind: 'coupon', verb: 'conflict', target: id, detail: `appliesTo names no plan: ${unresolved.join(', ')}` })
      return
    }
    actions.push({ kind: 'coupon', verb: 'create', target: id })
    if (!dryRun) {
      await stripe.coupons.create({
        id,
        ...(coupon.name ? { name: coupon.name } : {}),
        ...(coupon.percentOff !== undefined ? { percent_off: coupon.percentOff } : {}),
        ...(coupon.amountOff !== undefined ? { amount_off: coupon.amountOff, currency: coupon.currency ?? 'usd' } : {}),
        duration: coupon.duration,
        ...(coupon.duration === 'repeating' && coupon.durationInMonths ? { duration_in_months: coupon.durationInMonths } : {}),
        ...(coupon.maxRedemptions ? { max_redemptions: coupon.maxRedemptions } : {}),
        ...(products.length ? { applies_to: { products: products as string[] } } : {}),
      })
    }
  }

  for (const code of coupon.codes ?? (coupon.code ? [coupon.code] : [])) {
    const existing = (await stripe.promotionCodes.list({ code, active: true, limit: 1 })).data[0]
    if (existing && promotionCouponId(existing) === id) {
      actions.push({ kind: 'promotion-code', verb: 'reuse', target: code, detail: existing.id })
      continue
    }
    if (existing) {
      actions.push({ kind: 'promotion-code', verb: 'conflict', target: code, detail: `already belongs to coupon ${promotionCouponId(existing)}` })
      continue
    }
    actions.push({ kind: 'promotion-code', verb: 'create', target: code, detail: `for ${id}` })
    if (!dryRun)
      await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: id }, code })
  }
}

/** Keep this app's portal configuration matching `saas.portal`. Unlike a coupon, it can be edited. */
async function reconcilePortal(dryRun: boolean, actions: SetupProductAction[]): Promise<void> {
  const params = portalConfigurationParams(saas.portal!)
  const live = await findManagedPortalConfiguration(undefined, stripe)

  if (live && portalConfigurationMatches(live, params)) {
    actions.push({ kind: 'portal', verb: 'reuse', target: 'customer portal', detail: live.id })
    return
  }
  if (live) {
    actions.push({ kind: 'portal', verb: 'update', target: 'customer portal', detail: live.id })
    if (!dryRun)
      await stripe.billingPortal.configurations.update(live.id, params)
    return
  }
  actions.push({ kind: 'portal', verb: 'create', target: 'customer portal' })
  if (!dryRun)
    await stripe.billingPortal.configurations.create(params)
}

/** Render a report as one line per action, for the CLI to print. */
export function formatSetupReport(report: SetupProductsReport): string[] {
  if (!report.actions.length)
    return ['No plans, coupons or portal are declared in config/saas.ts, so there is nothing to provision.']

  const verbs: Record<SetupProductAction['verb'], string> = {
    reuse: 'already exists',
    replace: 'moves lookup key to a new price',
    update: 'updates',
    conflict: 'CONFLICT, left alone',
    create: 'creates',
  }
  return report.actions.map((action) => {
    const verb = verbs[action.verb]
    return `  ${action.kind} "${action.target}" ${verb}${action.detail ? ` (${action.detail})` : ''}`
  })
}
