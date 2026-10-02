/**
 * Money, at every boundary it crosses.
 *
 * Every amount Stacks commerce stores is an integer in the currency's MINOR
 * unit: cents for USD, whole yen for JPY, fils for KWD. `products.price`,
 * `order_items.price`, `orders.total_amount`, `payments.amount` and the rest
 * hold that integer, and arithmetic (order totals, refunds) happens on it.
 *
 * Conversion happens only where a human or a foreign system is on the other
 * side, and only through this module:
 *
 * - display: `formatCurrency(1999, 'USD')` is `"$19.99"`
 * - input: `parseMoneyInput('19.99', 'USD')` is `1999`
 * - reports: `formatMinor(1999, 'USD')` is `"19.99 USD"`
 * - import: `decimalToMinor('19.99')` and `rescaleMinor(...)`
 *
 * Decimal strings are converted with string and BigInt arithmetic, never
 * through a float: `Math.round(19.99 * 100)` happens to be right,
 * `Math.round(1.005 * 100)` is 100 rather than 101.
 *
 * The module has no imports, so it is safe to bundle into the browser. The
 * dashboard reaches it as `@stacksjs/commerce/money`; server code can use the
 * `@stacksjs/commerce` barrel.
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
 * overwhelmingly common case.
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
 * else, because each is ambiguous in some locale (`"1,000"` is one in German).
 * Digits past the currency's precision round half up, which only arises when a
 * store is configured with more decimals than its currency has.
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

/** `1999, 'USD' -> "19.99 USD"`, for reports and exports. Never used for storage. */
export function formatMinor(minor: number, currency: string | null): string {
  const exponent = currencyExponent(currency)
  const whole = Math.round(Number(minor))
  const amount = Number.isSafeInteger(whole)
    ? `${whole < 0 ? '-' : ''}${minorToDecimal(Math.abs(whole), exponent)}`
    : String(minor)
  return currency ? `${amount} ${currency}` : amount
}

/**
 * A stored minor-unit amount as major units, for `Intl.NumberFormat` and
 * charts. `1999, 'USD' -> 19.99`, `1999, 'JPY' -> 1999`, `1999, 'KWD' -> 1.999`.
 *
 * Display only: the result is a float, so never store it or add it up.
 * A non-integer input is rounded to the nearest minor unit first, which is
 * what a legacy row holding a fraction of a cent would have meant.
 */
export function minorToMajor(minor: number | string | null | undefined, currency: string | null | undefined): number {
  const value = Math.round(Number(minor ?? 0))
  if (!Number.isFinite(value))
    return 0

  const decimal = minorToDecimal(Math.abs(value), currencyExponent(currency))
  return value < 0 ? -Number(decimal) : Number(decimal)
}

/**
 * A stored minor-unit amount, formatted for people.
 *
 * `formatCurrency(1999, 'USD', 'en-US')` is `"$19.99"`; `(1999, 'JPY', 'en-US')`
 * is `"¥1,999"`. The locale defaults to the runtime's (the viewer's browser in
 * the dashboard). A currency code `Intl` does not know falls back to the
 * report form, `"19.99 XYZ"`, rather than throwing out of a table render.
 */
export function formatCurrency(
  minor: number | string | null | undefined,
  currency: string | null | undefined,
  locale?: string,
): string {
  const code = (currency || 'USD').toUpperCase()
  const major = minorToMajor(minor, code)
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(major)
  }
  catch {
    return formatMinor(Math.round(Number(minor ?? 0)) || 0, code)
  }
}

/**
 * A stored minor-unit amount as the decimal string an input field shows,
 * e.g. `1999, 'USD' -> "19.99"`. The inverse of `parseMoneyInput`.
 */
export function minorToInput(minor: number | string | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined || minor === '')
    return ''
  const value = Math.round(Number(minor))
  if (!Number.isFinite(value))
    return ''
  const decimal = minorToDecimal(Math.abs(value), currencyExponent(currency))
  return value < 0 ? `-${decimal}` : decimal
}

/** The `step` attribute for a money input: `"0.01"` for USD, `"1"` for JPY. */
export function moneyInputStep(currency: string | null | undefined): string {
  const exponent = currencyExponent(currency)
  return exponent === 0 ? '1' : `0.${'1'.padStart(exponent, '0')}`
}

export interface MoneyInputOptions {
  /** Smallest accepted amount, in MINOR units. Defaults to 0. */
  min?: number
  /** Largest accepted amount, in MINOR units. */
  max?: number
  /** Whether an empty field is an error (default) or means "no amount". */
  required?: boolean
}

/**
 * Why `input` is not an acceptable amount of `currency`, or `''` when it is.
 *
 * For forms: the dashboard disables Save and shows this next to the field.
 * Stricter than `decimalToMinor` on purpose: a person typing `19.999` for a
 * USD price has made a mistake, and rounding it silently would hide that.
 */
export function moneyInputError(
  input: string | number | null | undefined,
  currency: string | null | undefined,
  options: MoneyInputOptions = {},
): string {
  const raw = input === null || input === undefined ? '' : String(input).trim()
  const exponent = currencyExponent(currency)
  const code = (currency || 'USD').toUpperCase()

  if (raw === '')
    return options.required === false ? '' : 'Enter an amount.'

  const match = /^(\d*)(?:\.(\d*))?$/.exec(raw)
  if (!match || !/\d/.test(raw))
    return exponent === 0
      ? 'Enter a whole number, for example 1999.'
      : `Enter a plain amount, for example ${minorToDecimal(1999, exponent)}.`

  const fraction = match[2] ?? ''
  if (fraction.length > exponent) {
    return exponent === 0
      ? `${code} amounts have no decimal places.`
      : `${code} amounts have at most ${exponent} decimal ${exponent === 1 ? 'place' : 'places'}.`
  }

  let minor: number | null
  try {
    minor = decimalToMinor(raw, exponent)
  }
  catch {
    return 'That amount is too large.'
  }

  if (minor === null)
    return 'Enter an amount.'
  if (options.min !== undefined && minor < options.min)
    return `Enter at least ${formatMinor(options.min, code)}.`
  if (options.max !== undefined && minor > options.max)
    return `Enter at most ${formatMinor(options.max, code)}.`
  return ''
}

/**
 * A money field's value as integer minor units: `"19.99"` in USD is `1999`.
 *
 * Throws `PriceFormatError` with the same message `moneyInputError` gives, so
 * a caller that skipped validation still cannot store a float. Returns null
 * only for an empty, optional field.
 */
export function parseMoneyInput(
  input: string | number | null | undefined,
  currency: string | null | undefined,
  options?: MoneyInputOptions & { required?: true },
): number
export function parseMoneyInput(
  input: string | number | null | undefined,
  currency: string | null | undefined,
  options: MoneyInputOptions & { required: false },
): number | null
export function parseMoneyInput(
  input: string | number | null | undefined,
  currency: string | null | undefined,
  options: MoneyInputOptions = {},
): number | null {
  const error = moneyInputError(input, currency, options)
  if (error)
    throw new PriceFormatError(input, error)

  return decimalToMinor(input, currencyExponent(currency))
}
