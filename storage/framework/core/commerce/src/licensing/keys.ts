/**
 * License keys, buyer addresses and purchase references: the strings that
 * cross the boundary, and how each is read back.
 */

import type { LicenseTier } from './token'
import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TIERS: readonly LicenseTier[] = ['standard', 'lifetime', 'team']

/**
 * `XXXX-XXXX-XXXX-XXXX-XXXX`: 100 random bits in an alphabet with no 0/O or
 * 1/I, in the five groups of four the `LicenseKey` model validates.
 */
export function generateLicenseKey(bytes: Uint8Array = randomBytes(13)): string {
  if (bytes.length < 13)
    throw new Error('A license key needs 13 random bytes')
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    // Only the bits not yet written out are kept: `<<` works on 32 bits.
    value = ((value & ((1 << bits) - 1)) << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out.slice(0, 20).match(/.{4}/g)!.join('-')
}

/** A key as typed or pasted: case, spaces and missing dashes forgiven. Null when it cannot be one. */
export function normalizeLicenseKey(input: unknown): string | null {
  if (typeof input !== 'string')
    return null
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z0-9]{20}$/.test(compact))
    return null
  return compact.match(/.{4}/g)!.join('-')
}

/**
 * An address as typed, trimmed and lower-cased, or null when it cannot be
 * one. Deliberately loose (the real check is whether mail arrives), except
 * that it refuses `%`, which no buyer's address has and which a LIKE lookup
 * would read as a wildcard.
 */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string')
    return null
  const email = input.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@%]+@[^\s@%]+\.[^\s@%]+$/.test(email))
    return null
  return email
}

export interface LicensePurchase {
  tier: LicenseTier
  /** People covered. One unless the tier is `team`. */
  seats: number
  /** The product the license is for, when the app sells more than one. */
  productId: number | null
}

/**
 * The `reference` to start a license checkout with:
 *
 * ```ts
 * await paymentDriver().checkout(payer, {
 *   mode: 'payment',
 *   lines: [{ name: 'Pro', unitAmount: 3900, quantity: 1 }],
 *   successUrl,
 *   reference: licensePurchaseReference({ tier: 'standard' }),
 * })
 * ```
 *
 * Every payment driver echoes a checkout's reference in its webhook, so this
 * is how a paid event says "issue a license, of this tier" without the
 * framework knowing the provider. It is unique per checkout, which is what
 * makes issuing idempotent, and uses only letters, digits, `_` and `-`,
 * the characters every provider accepts.
 */
export function licensePurchaseReference(purchase: { tier: LicenseTier, seats?: number, productId?: number | null }): string {
  if (!TIERS.includes(purchase.tier))
    throw new Error(`Not a license tier: ${String(purchase.tier)}`)
  const seats = purchase.seats ?? 1
  if (!Number.isSafeInteger(seats) || seats < 1)
    throw new Error('A license covers at least one seat')
  const productId = purchase.productId ?? 0
  if (!Number.isSafeInteger(productId) || productId < 0)
    throw new Error('A product id is a positive integer')
  return `lic_${purchase.tier}_${seats}_${productId}_${randomBytes(12).toString('hex')}`
}

/** What a purchase reference asks for, or null when the reference is not a license purchase. */
export function parseLicensePurchaseReference(reference: unknown): LicensePurchase | null {
  if (typeof reference !== 'string')
    return null
  const match = reference.match(/^lic_(standard|lifetime|team)_(\d{1,6})_(\d{1,15})_[a-f0-9]{24}$/)
  if (!match)
    return null
  const seats = Number(match[2])
  if (seats < 1)
    return null
  const productId = Number(match[3])
  return { tier: match[1] as LicenseTier, seats, productId: productId > 0 ? productId : null }
}
