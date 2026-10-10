import { InputValidationError, parseBooleanInput, parseEnumInput, parseNumberInput, parseTextInput } from '@stacksjs/validation/input'
import type { TaxRateWriteData } from './tax/types'

export interface SalesTaxSetup { label: string, rates: Array<{ code: string, name: string, rate: number }> }
export interface SalesTaxInputOptions { maxRate?: number, maxRates?: number }

/** Parse an explicit multi-component configuration. A missing rates array never removes tax. */
export function parseSalesTaxSetup(body: unknown, options: SalesTaxInputOptions = {}): SalesTaxSetup {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputValidationError('Send a JSON object')
  const input = body as Record<string, unknown>
  const label = input.label === undefined ? 'Sales tax' : parseTextInput(input.label, 'label', true, 40)!
  if (!Array.isArray(input.rates)) throw new InputValidationError('rates must be an array; send [] to remove sales tax')
  const maximum = options.maxRates ?? 6
  if (input.rates.length > maximum) throw new InputValidationError(`At most ${maximum} tax rates`)
  const codes = new Set<string>()
  const rates = input.rates.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputValidationError('Each tax rate must be an object')
    const entry = value as Record<string, unknown>
    const rate = parseNumberInput(entry.rate, 'Tax rate', 0, options.maxRate ?? 100)
    if (rate === null) throw new InputValidationError('A tax rate is required')
    const name = parseTextInput(entry.name, 'name', true, 60)!
    const rawCode = entry.code == null || entry.code === '' ? name : parseTextInput(entry.code, 'code', true)!
    const code = rawCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tax'
    if (codes.has(code)) throw new InputValidationError('Each tax rate needs a distinct code')
    codes.add(code)
    return { code, name, rate: Math.round(rate * 10000) / 10000 }
  })
  return { label, rates }
}

/** Native tax write paths normalize explicit values instead of testing their truthiness. */
export function parseTaxRateWriteData(input: TaxRateWriteData): TaxRateWriteData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputValidationError('Send a tax rate object')
  const values = { ...input }
  if (input.rate !== undefined) {
    const rate = parseNumberInput(input.rate, 'rate', 0, 100)
    if (rate === null) throw new InputValidationError('rate is required')
    values.rate = rate
  }
  for (const key of ['is_default', 'exemptible'] as const) {
    if (key in input) values[key] = parseBooleanInput(input[key], key)
  }
  if (input.status !== undefined) values.status = parseEnumInput(input.status, 'status', ['active', 'inactive'])
  for (const key of ['name', 'type', 'country'] as const) {
    if (key in input) values[key] = parseTextInput(input[key], key, true, key === 'name' ? 255 : 100)!
  }
  if ('code' in input) values.code = parseTextInput(input.code, 'code', false, 64) ?? ''
  if ('region' in input) values.region = parseTextInput(input.region, 'region')
  return values
}
