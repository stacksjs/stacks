import type { CatalogWarning } from './types'
import { decimalToMinor, numberToMinor, PriceFormatError } from './money'
import { cleanName, optionalString } from './text'

/**
 * Small pure helpers the three customer and order mappers share.
 *
 * Money stays in the decimal-string domain until it is an integer: a signed
 * amount has its sign split off and the magnitude goes through the same
 * `decimalToMinor` the catalog uses, and a division (a line total spread over
 * its quantity) is done on integers with an explicit half-up rounding.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * An email as the deduplication key: trimmed and lowercased, or null when it
 * is not an address at all. The domain part is case-insensitive by spec, and
 * every platform treats the local part that way in practice, so `Bob@Shop.com`
 * and `bob@shop.com ` are one customer.
 */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string')
    return null
  const email = input.trim().toLowerCase()
  return EMAIL.test(email) ? email : null
}

/** A timestamp as ISO 8601 UTC, or null when it is missing or unreadable. */
export function isoTimestamp(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim() === '')
    return null
  const at = new Date(input.trim())
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/**
 * WooCommerce's `*_gmt` fields are UTC without a zone designator
 * (`2026-09-14T09:12:44`), which `Date` would read as local time.
 */
export function gmtTimestamp(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim() === '')
    return null
  const raw = input.trim()
  return isoTimestamp(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`)
}

/** `first last`, collapsed, or null when both are empty. */
export function personName(...parts: unknown[]): string | null {
  const name = parts.map(part => cleanName(part)).filter(Boolean).join(' ')
  return name === '' ? null : name
}

/** A phone number as text, capped at the `customers.phone` length. */
export function phoneOf(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const phone = optionalString(typeof candidate === 'number' ? String(candidate) : candidate)
    if (phone)
      return phone.slice(0, 50)
  }
  return null
}

/** Address parts joined into the single line `orders.delivery_address` holds. */
export function addressLine(...parts: unknown[]): string | null {
  const line = parts.map(part => cleanName(part)).filter(Boolean).join(', ')
  return line === '' ? null : line
}

/**
 * A signed decimal (a string, or a JSON number) as signed integer minor units.
 *
 * `decimalToMinor` accepts magnitudes only, so the sign is split off first.
 * A float is never multiplied: a JSON number goes through the decimal string
 * it was serialized as (`numberToMinor`).
 */
export function signedMinor(value: unknown, exponent: number): number | null {
  if (value === null || value === undefined || value === '')
    return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new PriceFormatError(value, 'expected a finite number')
    const magnitude = numberToMinor(Math.abs(value), exponent)!
    return value < 0 ? -magnitude : magnitude
  }
  if (typeof value !== 'string')
    throw new PriceFormatError(value, 'expected a decimal amount')
  const raw = value.trim()
  const negative = raw.startsWith('-')
  const magnitude = decimalToMinor(negative || raw.startsWith('+') ? raw.slice(1) : raw, exponent)
  if (magnitude === null)
    return null
  return negative ? -magnitude : magnitude
}

/**
 * An amount that must not be negative, as minor units, or `fallback` with a
 * warning when it is missing, malformed or negative. The order tables hold
 * every amount as a non-negative integer.
 */
export function amountOrZero(value: unknown, exponent: number, label: string, externalId: string, warnings: CatalogWarning[], fallback = 0): number {
  let minor: number | null
  try {
    minor = signedMinor(value, exponent)
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `${label}: ${error.message}; recorded as ${fallback}` })
    return fallback
  }
  if (minor === null)
    return fallback
  if (minor < 0) {
    warnings.push({ externalId, message: `${label} is negative (${String(value)}); recorded as ${fallback}` })
    return fallback
  }
  return minor
}

/**
 * A line total spread over its quantity, in minor units, rounded half up.
 * Integer arithmetic only: `(2 * total + quantity) / (2 * quantity)`, floored.
 */
export function unitFromTotal(totalMinor: number, quantity: number): number {
  if (quantity <= 1)
    return totalMinor
  return Math.floor((2 * totalMinor + quantity) / (2 * quantity))
}

/** A positive whole quantity, or null. */
export function quantityOf(value: unknown): number | null {
  const quantity = typeof value === 'string' ? Number(value) : value
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0 ? quantity : null
}

/** A three-letter ISO 4217 code, uppercased, or null. */
export function currencyCode(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(code) ? code : null
}
