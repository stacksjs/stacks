/**
 * What tax is owed on an amount, component by component.
 *
 * The tax rates a dashboard manages did not price anything. `recomputeOrderTotals`
 * takes a single `taxRateId`, multiplies once, and returns one number — so a
 * business whose tax is a sum of parts had to blend them into one rate before
 * storing it, and a blended rate cannot answer the question that matters when
 * a customer is exempt: exempt from *which part*?
 *
 * Most jurisdictions tax in parts and lift some of them for some buyers.
 * Groceries escape VAT but not a deposit levy. A Californian medical cannabis
 * patient is exempt from sales tax and still pays excise and the city's
 * business tax. Blending those into one number leaves an application choosing
 * between over-charging the exempt customer and under-collecting tax it owes.
 *
 * So: rates are rows, an exemption lifts the ones marked `exemptible`, and the
 * result itemises what was charged and what was not.
 */

import { db } from '@stacksjs/database'

/** One component, as it applied to this sale. */
export interface TaxComponent {
  id: number
  /** Stable identifier for code to branch on. */
  code: string
  /** What an operator called it, for the receipt. */
  name: string
  /** Decimal multiplier — `0.095` for 9.5%. */
  rate: number
  /** Cents charged for this component. Zero when it was exempted. */
  amount: number
  /** Whether an exemption lifted it on this sale. */
  exempted: boolean
}

export interface TaxBreakdown {
  /** The amount tax was computed on. */
  taxable: number
  /** Every component that applied, charged or not. */
  components: TaxComponent[]
  /** Total charged, in cents. */
  tax: number
  /** Total lifted by the exemption, in cents. */
  exempted: number
}

export interface BreakdownOptions {
  /**
   * The buyer qualifies for an exemption, so components marked `exemptible`
   * are not charged.
   *
   * What qualifies is the application's business — a medical card, a resale
   * certificate, a charity number. By the time it reaches here that has been
   * decided.
   */
  exempt?: boolean
  /** Limit to these codes. Absent means every active rate. */
  codes?: string[]
  /** Limit to one country, matched exactly against the stored value. */
  country?: string
}

/**
 * A stored rate as a decimal multiplier.
 *
 * Rates are entered as percentages, because that is how tax is written down
 * and how the dashboard asks for it. Multiplying by a percentage would charge
 * a hundred times too much, which is the kind of error that reaches a
 * customer's card before anyone notices.
 */
function multiplierOf(rate: unknown): number {
  const percent = Number(rate)

  return Number.isFinite(percent) ? percent / 100 : 0
}

/** Every active rate, in the order they should be listed. */
export async function activeTaxRates(options: BreakdownOptions = {}): Promise<any[]> {
  let query = db
    .selectFrom('tax_rates')
    .where('status', '=', 'active')
    .selectAll()

  if (options.country)
    query = query.where('country', '=', options.country)

  const rows = await query.execute()

  if (!options.codes?.length)
    return rows

  const wanted = new Set(options.codes)

  return rows.filter((row: any) => wanted.has(String(row.code ?? '')))
}

/**
 * Tax on `taxable` cents, itemised.
 *
 * Each component is rounded on its own rather than the total being rounded
 * once. That is what a receipt has to show — the parts have to add up to the
 * figure charged, and a single rounding at the end leaves a line that is a
 * cent out from the sum above it.
 *
 * Every component is applied to `taxable` directly. Jurisdictions that compound
 * — where one tax forms part of the base for another — need an explicit order,
 * and that is a bigger claim than this should make quietly; an app that needs
 * it should compose two calls.
 */
/** One tax rate row, in the terms the breakdown reads it. */
export interface TaxRateRow {
  id?: number | string
  name?: string
  code?: string
  rate?: number | string
  exemptible?: boolean
}

export function breakdownFor(taxable: number, rates: readonly TaxRateRow[], options: BreakdownOptions = {}): TaxBreakdown {
  const base = Math.max(0, Math.round(taxable))
  const components: TaxComponent[] = []

  let tax = 0
  let exempted = 0

  for (const row of rates) {
    const rate = multiplierOf(row.rate)
    const full = Math.round(base * rate)
    const lifted = Boolean(options.exempt && row.exemptible)

    if (lifted)
      exempted += full
    else
      tax += full

    components.push({
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      rate,
      amount: lifted ? 0 : full,
      exempted: lifted,
    })
  }

  return { taxable: base, components, tax, exempted }
}

/**
 * Read the active rates and apply them.
 *
 * The convenience form. An app that already holds the rates — a checkout
 * pricing several bags, say — should fetch once and call {@link breakdownFor}
 * per bag rather than querying each time.
 */
export async function taxFor(taxable: number, options: BreakdownOptions = {}): Promise<TaxBreakdown> {
  return breakdownFor(taxable, await activeTaxRates(options), options)
}
