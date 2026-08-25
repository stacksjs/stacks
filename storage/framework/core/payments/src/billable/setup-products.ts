import type Stripe from 'stripe'
import type { Result } from '@stacksjs/error-handling'
import { saas } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'

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
  kind: 'product' | 'price'
  /** `create` writes a new object, `reuse` found an equivalent one, `replace` moves a lookup key onto a new price. */
  verb: 'create' | 'reuse' | 'replace'
  /** Product name, or the price's lookup key. */
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
  const plans = saas.plans

  try {
    if (plans === undefined || !plans.length)
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

    return ok({ dryRun, actions })
  }
  catch (error) {
    const e = error instanceof Error ? error : new Error(String(error))
    log.error(e)

    return err(e)
  }
}

/** Render a report as one line per action, for the CLI to print. */
export function formatSetupReport(report: SetupProductsReport): string[] {
  if (!report.actions.length)
    return ['No plans are declared in config/saas.ts, so there is nothing to provision.']

  return report.actions.map((action) => {
    const verb = action.verb === 'reuse'
      ? 'already exists'
      : action.verb === 'replace'
        ? 'moves lookup key to a new price'
        : 'creates'
    return `  ${action.kind} "${action.target}" ${verb}${action.detail ? ` (${action.detail})` : ''}`
  })
}
