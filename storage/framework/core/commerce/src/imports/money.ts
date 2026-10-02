/**
 * Money at the import boundary.
 *
 * Sources hand prices over in two shapes. Shopify sends decimal strings in the
 * shop's currency (`"19.99"`); the WooCommerce Store API sends an integer
 * string already in minor units, plus how many decimals the STORE is
 * configured with (`currency_minor_unit`), which is not always the ISO number.
 *
 * Both are converted with string and BigInt arithmetic, never through a float:
 * `Math.round(19.99 * 100)` happens to be right, `Math.round(1.005 * 100)` is
 * 100 rather than 101, and an importer that is right "most of the time" is
 * wrong on somebody's catalog.
 *
 * The result is integer minor units of the currency's ISO 4217 exponent (cents
 * for USD, whole yen for JPY, fils for KWD), which is what `products.price`
 * holds.
 */

export class PriceFormatError extends Error {
  constructor(public readonly value: unknown, reason: string) {
    super(`Unreadable price ${JSON.stringify(value)}: ${reason}`)
    this.name = 'PriceFormatError'
  }
}

/**
 * Decimal places of a currency's minor unit (USD 2, JPY 0, KWD 3).
 *
 * Read from `Intl`, which carries the ISO 4217 table, so there is no list here
 * to fall out of date. Unknown or missing codes are treated as 2 decimals, the
 * overwhelmingly common case; the importer warns when it had to assume.
 */
export function currencyExponent(currency: string | null | undefined): number {
  if (!currency)
    return 2

  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
    return typeof digits === 'number' ? digits : 2
  }
  catch {
    return 2
  }
}

/**
 * A decimal price string as integer minor units.
 *
 * Accepts plain decimals only: `"19.99"`, `"0.10"`, `"1999"`, `"19.9"`, `".5"`.
 * Rejects thousands separators (`"1,000.00"`), signs, exponents and anything
 * else, because each is ambiguous in some locale (`"1,000"` is one in German)
 * and neither source emits them. Digits past the currency's precision round
 * half up, which only arises when a store is configured with more decimals
 * than its currency has.
 *
 * @returns The amount in minor units, or null for an empty value (unpriced).
 */
export function decimalToMinor(value: string | number | null | undefined, exponent = 2): number | null {
  if (value === null || value === undefined)
    return null

  const raw = String(value).trim()
  if (raw === '')
    return null

  const match = /^(\d*)(?:\.(\d*))?$/.exec(raw)
  if (!match || !/\d/.test(raw))
    throw new PriceFormatError(value, 'expected a plain decimal such as 19.99')

  const whole = match[1] || '0'
  const fraction = match[2] ?? ''

  let minor: bigint
  if (fraction.length <= exponent) {
    minor = BigInt(whole + fraction.padEnd(exponent, '0'))
  }
  else {
    minor = BigInt(whole + fraction.slice(0, exponent))
    if (fraction.charCodeAt(exponent) >= 53) // '5'
      minor += 1n
  }

  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new PriceFormatError(value, 'too large to store exactly')

  return Number(minor)
}

/** Integer minor units back to a decimal string, e.g. `1999, 2 -> "19.99"`. */
export function minorToDecimal(minor: number | bigint | string, exponent = 2): string {
  const raw = String(minor).trim()
  if (!/^\d+$/.test(raw))
    throw new PriceFormatError(minor, 'expected a non-negative integer amount in minor units')

  if (exponent === 0)
    return raw.replace(/^0+(?=\d)/, '')

  const padded = raw.padStart(exponent + 1, '0')
  const whole = padded.slice(0, -exponent).replace(/^0+(?=\d)/, '')
  return `${whole}.${padded.slice(-exponent)}`
}

/**
 * Minor units at one precision as minor units at another.
 *
 * WooCommerce reports `prices.price` at the store's configured decimals
 * (`currency_minor_unit`). A USD store set to 0 decimals sends `"20"` for
 * $20.00, which must become 2000 cents, not 20.
 */
export function rescaleMinor(amount: string | number | null | undefined, fromExponent: number, toExponent: number): number | null {
  if (amount === null || amount === undefined || String(amount).trim() === '')
    return null

  if (!Number.isInteger(fromExponent) || fromExponent < 0)
    throw new PriceFormatError(amount, `invalid source precision ${fromExponent}`)

  return decimalToMinor(minorToDecimal(String(amount), fromExponent), toExponent)
}

/** `1999, 'USD' -> "19.99 USD"`, for reports. Never used for storage. */
export function formatMinor(minor: number, currency: string | null): string {
  const amount = minorToDecimal(minor, currencyExponent(currency))
  return currency ? `${amount} ${currency}` : amount
}
