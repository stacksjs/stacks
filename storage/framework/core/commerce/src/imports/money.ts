import { decimalToMinor, PriceFormatError } from '../money'

/**
 * Money at the import boundary.
 *
 * Sources hand prices over in three shapes. Shopify sends decimal strings in
 * the shop's currency (`"19.99"`); the WooCommerce Store API sends an integer
 * string already in minor units, plus how many decimals the STORE is
 * configured with (`currency_minor_unit`), which is not always the ISO number;
 * the Shopware Store API sends JSON numbers (`19.99`, `0.1`, `1999.5`).
 *
 * Both string shapes are converted by the commerce-wide money module
 * (`../money`), which the dashboard and the order export use as well, so an
 * imported `1999` and a dashboard-entered `19.99` land as the same integer and
 * read back the same way (stacksjs/stacks#2851). JSON numbers are first
 * written out as the decimal string they were parsed from, then go the same
 * way, so no amount is ever multiplied as a float.
 */

export {
  currencyExponent,
  decimalToMinor,
  formatMinor,
  minorToDecimal,
  PriceFormatError,
  rescaleMinor,
} from '../money'

/**
 * A JSON number as the plain decimal string it was written as.
 *
 * `String()` gives the shortest decimal that parses back to the same double,
 * which is the literal the source serialized: `19.99` is `"19.99"`, not the
 * `19.989999999999998` the double actually holds. Only the exponent form
 * (`1e-7`, `1e+21`) needs expanding, and that is done on the digits, not by
 * arithmetic.
 */
export function numberToDecimalString(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new PriceFormatError(value, 'expected a finite number')
  if (value < 0)
    throw new PriceFormatError(value, 'expected an amount of zero or more')

  const text = String(value)
  const match = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(text)
  if (!match)
    return text

  const [, whole, fraction = '', exponent] = match
  const digits = `${whole}${fraction}`
  const point = whole!.length + Number(exponent)

  if (point <= 0)
    return `0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length)
    return `${digits}${'0'.repeat(point - digits.length)}`
  return `${digits.slice(0, point)}.${digits.slice(point)}`
}

/**
 * A decimal amount that arrived as a JSON number (or a numeric string) as
 * integer minor units, or null when it is missing.
 */
export function numberToMinor(value: number | string | null | undefined, exponent = 2): number | null {
  if (value === null || value === undefined)
    return null
  if (typeof value === 'string')
    return decimalToMinor(value, exponent)
  return decimalToMinor(numberToDecimalString(value), exponent)
}
