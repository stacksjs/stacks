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

import { db } from '@stacksjs/database/runtime'

import type { BreakdownOptions, TaxBreakdown } from '../sales-tax'
import { breakdownFor } from '../sales-tax'

export { breakdownFor } from '../sales-tax'
export type { BreakdownOptions, TaxBreakdown, TaxComponent, TaxRateRow } from '../sales-tax'

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
 * Read the active rates and apply them.
 *
 * The convenience form. An app that already holds the rates — a checkout
 * pricing several bags, say — should fetch once and call {@link breakdownFor}
 * per bag rather than querying each time.
 */
export async function taxFor(taxable: number, options: BreakdownOptions = {}): Promise<TaxBreakdown> {
  return breakdownFor(taxable, await activeTaxRates(options), options)
}
