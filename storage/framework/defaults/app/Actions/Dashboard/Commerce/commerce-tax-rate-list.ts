import type { CommerceSqlRunner } from './commerce-sql'
import { db } from '@stacksjs/database/runtime'
import { sqlRows } from './commerce-sql'
import type { TaxRateRecord, TaxRateSummary } from './tax-rate-records'
import { normalizeTaxRateRecord, summarizeTaxRates } from './tax-rate-records'

/**
 * Every tax rate, newest first (stacksjs/stacks#3218).
 *
 * Tax rates are settings the page needs whole: it offers their countries and
 * types as filters and counts default conflicts across them. It used to read
 * the newest 500, so an older rate could not be found or edited, and the
 * cards, the filters and the default-conflict warning saw only those 500.
 */
export async function readTaxRates(run: CommerceSqlRunner = db): Promise<{ records: TaxRateRecord[], summary: TaxRateSummary }> {
  const records = sqlRows(await run.unsafe('SELECT * FROM tax_rates ORDER BY id DESC').execute()).map(normalizeTaxRateRecord)
  return { records, summary: summarizeTaxRates(records) }
}
