/**
 * The offline license token: what a desktop app keeps so it can tell, with no
 * network, whether it is licensed and which builds it may unlock.
 *
 * The server signs a small payload with an Ed25519 private key; the app
 * verifies it with the public key it was built with. Keys and signatures use
 * the conventions of the desktop updater (`@stacksjs/desktop` `updater.ts`):
 * a public key travels as `ed25519-public:<base64url SPKI DER>`, a signature
 * as base64url, and an app trusts a map of key id to public key so a key can
 * be rotated without stranding installed builds.
 *
 * This file imports nothing but `node:crypto`, so a compiled Bun agent can
 * take it (and `./client`) without the server's models or database.
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'

export type LicenseTier = 'standard' | 'lifetime' | 'team'

/** What the signature covers. Dates are ISO 8601 UTC strings. */
export interface LicenseTokenPayload {
  /** Format version. */
  v: 1
  /** The signing key's id, looked up in the app's trusted keys. */
  kid: string
  /** The license's public id (its uuid), never the key itself. */
  licenseId: string
  tier: LicenseTier
  /**
   * The last release date this license unlocks. Null means every build: a
   * lifetime license, or one that is paid for as long as it runs.
   */
  updatesUntil: string | null
  /**
   * When the license itself ends. Null for a license that is owned outright
   * (standard and lifetime), which is what makes its token good offline for
   * the builds it covers with no time limit.
   */
  expiresAt: string | null
  /** The SHA-256 of the device id the token was issued to. */
  deviceHash: string
  issuedAt: string
  /** The app must have checked in again by this date, unless the token is perpetual. */
  checkBy: string
}

export interface LicenseSigningKey {
  /** `ed25519-private:<base64url PKCS#8 DER>` */
  privateKey: string
  keyId: string
}

export interface LicenseSigningKeypair {
  keyId: string
  /** `ed25519-private:<base64url PKCS#8 DER>`. Server only: `LICENSE_SIGNING_KEY`. */
  privateKey: string
  /** `ed25519-public:<base64url SPKI DER>`. Embedded in the app. */
  publicKey: string
}

/** Key id to `ed25519-public:` key, the same shape the updater's `trustedKeys` takes. */
export type LicensePublicKeys = Record<string, string>

export type LicenseTokenFailure =
  | 'malformed'
  | 'unknown-key'
  | 'bad-signature'
  | 'wrong-device'

export class LicenseTokenError extends Error {
  readonly reason: LicenseTokenFailure

  constructor(reason: LicenseTokenFailure, message: string) {
    super(message)
    this.name = 'LicenseTokenError'
    this.reason = reason
  }
}

const PUBLIC_PREFIX = 'ed25519-public:'
const PRIVATE_PREFIX = 'ed25519-private:'
const KEY_ID = /^[\w.-]+$/
const DAY_MS = 24 * 60 * 60 * 1000

/** How long a token works with no check-in. */
export const OFFLINE_GRACE_DAYS = 30
/** How often an online app asks the server again. */
export const RECHECK_DAYS = 7

/** A new signing keypair, encoded the way `signLicenseToken` and `verifyLicenseToken` read them. */
export function generateLicenseSigningKeypair(keyId: string = `license-${new Date().toISOString().slice(0, 10)}`): LicenseSigningKeypair {
  if (!KEY_ID.test(keyId))
    throw new Error('A license signing key id may only use letters, numbers, dots, dashes and underscores')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return {
    keyId,
    privateKey: `${PRIVATE_PREFIX}${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url')}`,
    publicKey: `${PUBLIC_PREFIX}${publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')}`,
  }
}

/** The SHA-256 of a device id, hex. The server never sees or stores the id itself. */
export function hashDeviceId(deviceId: string): string {
  return createHash('sha256').update(deviceId, 'utf8').digest('hex')
}

export interface SignLicenseTokenInput {
  licenseId: string
  tier: LicenseTier
  updatesUntil: Date | string | null
  expiresAt?: Date | string | null
  deviceHash: string
  /** Defaults to now. */
  issuedAt?: Date
  /** Defaults to `OFFLINE_GRACE_DAYS`. */
  graceDays?: number
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined)
    return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()))
    throw new Error(`Not a date: ${String(value)}`)
  return date.toISOString()
}

/** `<base64url payload>.<base64url signature>`. The signature covers the payload bytes exactly as sent. */
export function signLicenseToken(input: SignLicenseTokenInput, key: LicenseSigningKey): string {
  if (!KEY_ID.test(key.keyId))
    throw new Error('The license signing key id is not valid')
  if (!key.privateKey.startsWith(PRIVATE_PREFIX))
    throw new Error('The license signing key has an invalid encoding: expected ed25519-private:<base64url>')
  if (!/^[a-f0-9]{64}$/.test(input.deviceHash))
    throw new Error('A license token needs the SHA-256 of a device id')

  const privateKey = createPrivateKey({ key: Buffer.from(key.privateKey.slice(PRIVATE_PREFIX.length), 'base64url'), format: 'der', type: 'pkcs8' })
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error('The license signing key is not an Ed25519 key')

  const issuedAt = input.issuedAt ?? new Date()
  const payload: LicenseTokenPayload = {
    v: 1,
    kid: key.keyId,
    licenseId: input.licenseId,
    tier: input.tier,
    updatesUntil: iso(input.updatesUntil),
    expiresAt: iso(input.expiresAt),
    deviceHash: input.deviceHash,
    issuedAt: issuedAt.toISOString(),
    checkBy: new Date(issuedAt.getTime() + (input.graceDays ?? OFFLINE_GRACE_DAYS) * DAY_MS).toISOString(),
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  return `${body.toString('base64url')}.${sign(null, body, privateKey).toString('base64url')}`
}

function isIsoOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}

/**
 * The payload of a token signed by a key the app trusts. Throws a
 * {@link LicenseTokenError} naming why not: `malformed`, `unknown-key`,
 * `bad-signature`, or `wrong-device` when `deviceHash` is given and differs.
 *
 * It says nothing about time. Whether the token is still good now is
 * {@link tokenStanding}; which builds it unlocks is {@link isEntitled}.
 */
export function verifyLicenseToken(token: string, publicKeys: LicensePublicKeys, deviceHash?: string): LicenseTokenPayload {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 2 || !parts.every(part => /^[\w-]+$/.test(part)))
    throw new LicenseTokenError('malformed', 'The license token is not in the expected format')

  const body = Buffer.from(parts[0]!, 'base64url')
  let payload: LicenseTokenPayload
  try {
    payload = JSON.parse(body.toString('utf8'))
  }
  catch {
    throw new LicenseTokenError('malformed', 'The license token payload is not JSON')
  }
  if (!payload || typeof payload !== 'object' || payload.v !== 1 || typeof payload.kid !== 'string' || !KEY_ID.test(payload.kid))
    throw new LicenseTokenError('malformed', 'The license token payload is not a version 1 payload')

  const encodedKey = Object.hasOwn(publicKeys, payload.kid) ? publicKeys[payload.kid] : undefined
  if (!encodedKey)
    throw new LicenseTokenError('unknown-key', `The license token is signed by a key this app does not trust: ${payload.kid}`)
  if (!encodedKey.startsWith(PUBLIC_PREFIX))
    throw new LicenseTokenError('unknown-key', 'The license public key has an invalid encoding: expected ed25519-public:<base64url>')

  let good = false
  try {
    const publicKey = createPublicKey({ key: Buffer.from(encodedKey.slice(PUBLIC_PREFIX.length), 'base64url'), format: 'der', type: 'spki' })
    const signature = Buffer.from(parts[1]!, 'base64url')
    good = publicKey.asymmetricKeyType === 'ed25519' && signature.length === 64 && verify(null, body, publicKey, signature)
  }
  catch {
    good = false
  }
  if (!good)
    throw new LicenseTokenError('bad-signature', 'The license token signature does not verify')

  const shapeOk = typeof payload.licenseId === 'string'
    && ['standard', 'lifetime', 'team'].includes(payload.tier)
    && isIsoOrNull(payload.updatesUntil)
    && isIsoOrNull(payload.expiresAt)
    && typeof payload.deviceHash === 'string'
    && typeof payload.issuedAt === 'string' && isIsoOrNull(payload.issuedAt)
    && typeof payload.checkBy === 'string' && isIsoOrNull(payload.checkBy)
  if (!shapeOk)
    throw new LicenseTokenError('malformed', 'The license token payload is missing fields')

  if (deviceHash !== undefined && payload.deviceHash !== deviceHash)
    throw new LicenseTokenError('wrong-device', 'The license token was issued to another device')
  return payload
}

type EntitlementFields = Pick<LicenseTokenPayload, 'tier' | 'updatesUntil'>

/**
 * The entitlement rule: does this license unlock the paid features of a build
 * released on `buildDate`?
 *
 * Yes for a lifetime license, and for any license with no end to its updates.
 * Otherwise yes exactly when the build was released on or before
 * `updatesUntil`: a standard license keeps every build from its year of
 * updates for good (the perpetual fallback) and none after it.
 */
export function isEntitled(license: EntitlementFields, buildDate: Date | string): boolean {
  if (license.tier === 'lifetime' || license.updatesUntil === null)
    return true
  const build = buildDate instanceof Date ? buildDate.getTime() : Date.parse(buildDate)
  const until = Date.parse(license.updatesUntil)
  if (Number.isNaN(build) || Number.isNaN(until))
    return false
  return build <= until
}

export type TokenStandingReason = 'ok' | 'expired' | 'check-overdue' | 'not-entitled'

export interface TokenStanding {
  /** The license is good right now, whatever build is running. */
  licensed: boolean
  /** Paid features are unlocked for the running build. */
  pro: boolean
  reason: TokenStandingReason
  /** The token has no clock on it for the builds it covers. */
  perpetual: boolean
  /** The app should ask the server again when it can. */
  recheckDue: boolean
}

/**
 * Where a verified token stands at `now` for a build released on `buildDate`.
 *
 * - A token for a license that is owned outright (no `expiresAt`) never
 *   expires for the builds it covers, online or not.
 * - Any other token works until its license expires, and offline until
 *   `checkBy` (30 days after it was issued).
 * - `recheckDue` turns true 7 days after the last successful check.
 */
export function tokenStanding(
  payload: LicenseTokenPayload,
  options: { buildDate: Date | string, now?: Date, lastCheckedAt?: Date | string | null },
): TokenStanding {
  const now = (options.now ?? new Date()).getTime()
  const entitled = isEntitled(payload, options.buildDate)
  const perpetual = payload.expiresAt === null
  const last = options.lastCheckedAt ? new Date(options.lastCheckedAt).getTime() : Date.parse(payload.issuedAt)
  const recheckDue = Number.isNaN(last) || now - last >= RECHECK_DAYS * DAY_MS

  if (perpetual) {
    // Owned outright: the builds it covers stay unlocked with no clock. A
    // build it does not cover is the free tier, however recent the check.
    return { licensed: true, pro: entitled, reason: entitled ? 'ok' : 'not-entitled', perpetual, recheckDue }
  }
  if (now > Date.parse(payload.expiresAt!))
    return { licensed: false, pro: false, reason: 'expired', perpetual, recheckDue: true }
  if (now > Date.parse(payload.checkBy))
    return { licensed: false, pro: false, reason: 'check-overdue', perpetual, recheckDue: true }
  return { licensed: true, pro: entitled, reason: entitled ? 'ok' : 'not-entitled', perpetual, recheckDue }
}
