/**
 * Software licensing: what a purchase turns into, which devices use it, and
 * whether it is still good.
 *
 * A license is a `LicenseKey` row. It is issued once per purchase (keyed by
 * the purchase's reference, so a webhook retry or a second event about the
 * same checkout finds the same one), activated on up to `maxDevices` devices
 * (`LicenseActivation`), and for a team covers `seats` people (`LicenseSeat`,
 * each a member of the license's `Team`). Every activation and check answers
 * with a signed token (`./token`) the app verifies offline.
 *
 * Three tiers:
 *
 * - `standard`: a year of updates. Builds released on or before
 *   `updatesUntil` stay unlocked for good; the license itself never expires.
 * - `lifetime`: every update, never expires.
 * - `team`: every update while it runs, `seats` people, ends at `expiresAt`
 *   (a year, extended by `extendLicense` on renewal).
 */

import type { PaymentEvent } from '@stacksjs/payments'
import type { LicenseSigningKey, LicenseTier } from './token'
import { randomUUIDv7 } from 'bun'
import { db as typedDb, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { env } from '@stacksjs/env'
import { generateLicenseKey, normalizeEmail, normalizeLicenseKey, parseLicensePurchaseReference } from './keys'
import { signLicenseToken } from './token'

// The license tables are newer than some apps' generated database types, and
// every query here names its columns, so the builder is used untyped.
const db = typedDb as any

export type LicenseStatus = 'active' | 'inactive' | 'unassigned' | 'revoked' | 'refunded'

/** A license, in the application's terms. */
export interface License {
  /** The license's public id (the row's uuid). What a token carries. */
  id: string
  rowId: number
  key: string
  tier: LicenseTier
  status: LicenseStatus
  email: string | null
  maxDevices: number
  seats: number
  /** ISO time of the last release it unlocks; null unlocks every release. */
  updatesUntil: string | null
  /** ISO time the license ends; null for one that never does. */
  expiresAt: string | null
  purchaseReference: string | null
  paymentReference: string | null
  provider: string | null
  /** Minor units (cents). */
  amountPaid: number | null
  /** Minor units (cents). */
  amountRefunded: number
  currency: string | null
  customerId: number | null
  productId: number | null
  orderId: number | null
  teamId: number | null
  revokedAt: string | null
}

export interface LicenseDeviceSummary {
  name: string | null
  platform: string | null
  lastSeenAt: string | null
}

/** What a device is told about its license. */
export interface LicenseStandingSummary {
  id: string
  tier: LicenseTier
  status: LicenseStatus
  updatesUntil: string | null
  expiresAt: string | null
  maxDevices: number
  /** Devices active now (for a team license, on this seat). */
  devices: number
  seats: number
}

export interface LicenseSeatSummary {
  userId: number
  teamMemberId: number | null
  email: string
  assignedAt: string | null
}

export type OnLicenseIssued = (license: License) => Promise<void> | void

export interface LicensingOptions {
  /** Defaults to the system clock. */
  now?: () => Date
  /** Defaults to `LICENSE_SIGNING_KEY` and `LICENSE_SIGNING_KEY_ID`. */
  signingKey?: LicenseSigningKey
  /** Told about a license the first time it has an address to be sent to. */
  onIssued?: OnLicenseIssued
  /** Years of updates a standard license buys, and a team license runs. Defaults to 1. */
  termYears?: number
}

/** The signing key is not configured, so no token can be issued. */
export class LicensingNotConfiguredError extends Error {
  constructor() {
    super('Licenses cannot be signed without a key: run `buddy license:keygen` and set LICENSE_SIGNING_KEY and LICENSE_SIGNING_KEY_ID.')
    this.name = 'LicensingNotConfiguredError'
  }
}

const TEMPLATES: Record<LicenseTier, string> = {
  standard: 'Standard License',
  lifetime: 'Premium License',
  team: 'Enterprise License',
}

let configured: LicensingOptions = {}
let fallbackOnIssued: OnLicenseIssued | undefined

/**
 * Defaults for every licensing call in this process. An option passed to a
 * call wins. Set `onIssued` here to send your own license email in place of
 * the framework's.
 */
export function configureLicensing(options: LicensingOptions): void {
  configured = { ...configured, ...options }
}

/**
 * What `onIssued` falls back to when an app configured none: the framework's
 * route files register the default license email here.
 */
export function registerDefaultLicenseMailer(onIssued: OnLicenseIssued): void {
  fallbackOnIssued = onIssued
}

/** The signing key from the environment, or null when none is set. */
export function licenseSigningKeyFromEnv(): LicenseSigningKey | null {
  const source = env as unknown as Record<string, string | undefined>
  const privateKey = source.LICENSE_SIGNING_KEY
  if (!privateKey)
    return null
  return { privateKey, keyId: source.LICENSE_SIGNING_KEY_ID || 'license-1' }
}

function resolve(options?: LicensingOptions): { now: () => Date, signingKey: () => LicenseSigningKey, onIssued?: OnLicenseIssued, termYears: number } {
  const merged = { ...configured, ...options }
  return {
    now: merged.now ?? (() => new Date()),
    signingKey: () => {
      const key = merged.signingKey ?? licenseSigningKeyFromEnv()
      if (!key)
        throw new LicensingNotConfiguredError()
      return key
    },
    onIssued: merged.onIssued ?? fallbackOnIssued,
    termYears: merged.termYears ?? 1,
  }
}

function isoOrNull(value: unknown): string | null {
  return parseSqlDateTime(value)?.toISOString() ?? null
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function toLicense(row: Record<string, any>): License {
  return {
    id: String(row.uuid),
    rowId: Number(row.id),
    key: String(row.key),
    tier: (row.tier ?? 'standard') as LicenseTier,
    status: (row.status ?? 'unassigned') as LicenseStatus,
    email: row.email ?? null,
    maxDevices: Number(row.max_devices ?? 2),
    seats: Number(row.seats ?? 1),
    updatesUntil: isoOrNull(row.updates_until),
    expiresAt: isoOrNull(row.expiry_date),
    purchaseReference: row.purchase_reference ?? null,
    paymentReference: row.payment_reference ?? null,
    provider: row.provider ?? null,
    amountPaid: numberOrNull(row.amount_paid),
    amountRefunded: Number(row.amount_refunded ?? 0),
    currency: row.currency ?? null,
    customerId: numberOrNull(row.customer_id),
    productId: numberOrNull(row.product_id),
    orderId: numberOrNull(row.order_id),
    teamId: numberOrNull(row.team_id),
    revokedAt: isoOrNull(row.revoked_at),
  }
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { message?: string, code?: string } | null
  const message = e?.message ?? ''
  return e?.code === '23505'
    || message.includes('UNIQUE constraint')
    || message.includes('Duplicate entry')
    || /duplicate key value/i.test(message)
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date.getTime())
  next.setUTCFullYear(next.getUTCFullYear() + years)
  return next
}

async function emit(name: string, license: License): Promise<void> {
  try {
    const mod = await import('@stacksjs/events') as { dispatch?: (name: string, payload: unknown) => void }
    mod.dispatch?.(name, { license })
  }
  catch {
    // Events are a courtesy to listeners; a license does not depend on them.
  }
}

async function rowByKey(key: string, trx: any = db): Promise<Record<string, any> | null> {
  return await trx.selectFrom('license_keys').where('key', '=', key).selectAll().executeTakeFirst() ?? null
}

async function rowById(id: number, trx: any = db): Promise<Record<string, any> | null> {
  return await trx.selectFrom('license_keys').where('id', '=', id).selectAll().executeTakeFirst() ?? null
}

/** The license with this key, however it was typed. */
export async function findLicenseByKey(rawKey: unknown): Promise<License | null> {
  const key = normalizeLicenseKey(rawKey)
  const row = key ? await rowByKey(key) : null
  return row ? toLicense(row) : null
}

/** The license issued for a purchase, for a thank-you page that shows the key. */
export async function findLicenseByPurchase(purchaseReference: string): Promise<License | null> {
  if (!purchaseReference)
    return null
  const row = await db.selectFrom('license_keys').where('purchase_reference', '=', purchaseReference).selectAll().executeTakeFirst()
  return row ? toLicense(row) : null
}

export interface IssueLicenseInput {
  /** Your reference for the purchase. One license is issued per reference. */
  purchaseReference: string
  tier: LicenseTier
  email?: string | null
  /** People covered. Defaults to 1. */
  seats?: number
  /** Devices per holder. Defaults to 2. */
  maxDevices?: number
  /** Overrides the tier's default: a year for `standard`, never for the others. */
  updatesUntil?: Date | null
  /** Overrides the tier's default: a year for `team`, never for the others. */
  expiresAt?: Date | null
  productId?: number | null
  customerId?: number | null
  orderId?: number | null
  teamId?: number | null
  provider?: string | null
  paymentReference?: string | null
  /** Minor units (cents). */
  amountPaid?: number | null
  currency?: string | null
}

async function announce(license: License, onIssued?: OnLicenseIssued): Promise<void> {
  await emit('license:issued', license)
  if (!onIssued || !license.email)
    return
  // A failed send is reported and never takes the purchase down with it: the
  // key is on the thank-you page, and a resend is one request away.
  try {
    await onIssued(license)
  }
  catch (error) {
    console.error(`[licensing] ${license.key.slice(-4)}: could not send the license email: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * The license for a purchase, created on first sight. `created` is false when
 * the purchase already had one, in which case nothing is sent again.
 */
export async function issueLicense(input: IssueLicenseInput, options?: LicensingOptions): Promise<{ license: License, created: boolean }> {
  const { now, onIssued, termYears } = resolve(options)
  if (!input.purchaseReference)
    throw new Error('A license is issued for a purchase reference')

  const existing = await findLicenseByPurchase(input.purchaseReference)
  if (existing)
    return { license: existing, created: false }

  const seats = input.seats ?? 1
  const maxDevices = input.maxDevices ?? 2
  if (!Number.isSafeInteger(seats) || seats < 1 || !Number.isSafeInteger(maxDevices) || maxDevices < 1)
    throw new Error('A license needs at least one seat and one device')
  if (input.amountPaid !== undefined && input.amountPaid !== null && (!Number.isSafeInteger(input.amountPaid) || input.amountPaid < 0))
    throw new Error('amountPaid is an integer in minor units (cents)')

  const at = now()
  const updatesUntil = input.updatesUntil !== undefined ? input.updatesUntil : input.tier === 'standard' ? addYears(at, termYears) : null
  const expiresAt = input.expiresAt !== undefined ? input.expiresAt : input.tier === 'team' ? addYears(at, termYears) : null
  const stamp = sqlDateTime(at)

  for (let attempt = 0; ; attempt++) {
    try {
      await db.insertInto('license_keys').values({
        uuid: randomUUIDv7(),
        key: generateLicenseKey(),
        template: TEMPLATES[input.tier],
        tier: input.tier,
        status: 'active',
        email: normalizeEmail(input.email),
        seats,
        max_devices: maxDevices,
        updates_until: updatesUntil ? sqlDateTime(updatesUntil) : null,
        expiry_date: expiresAt ? sqlDateTime(expiresAt) : null,
        purchase_reference: input.purchaseReference,
        payment_reference: input.paymentReference ?? null,
        provider: input.provider ?? null,
        amount_paid: input.amountPaid ?? null,
        amount_refunded: 0,
        currency: input.currency?.toLowerCase() ?? null,
        customer_id: input.customerId ?? null,
        product_id: input.productId ?? null,
        order_id: input.orderId ?? null,
        team_id: input.teamId ?? null,
        created_at: stamp,
        updated_at: stamp,
      }).execute()
      break
    }
    catch (error) {
      if (!isUniqueViolation(error))
        throw error
      // Another delivery of the same purchase got there first.
      const raced = await findLicenseByPurchase(input.purchaseReference)
      if (raced)
        return { license: raced, created: false }
      // Otherwise the key collided, which 100 random bits make a non-event; try another.
      if (attempt >= 3)
        throw error
    }
  }

  const license = (await findLicenseByPurchase(input.purchaseReference))!
  await announce(license, onIssued)
  return { license, created: true }
}

/**
 * The buyer's address, read from what each provider puts in its event. A
 * checkout that sets `metadata.email` is read on any driver; otherwise this
 * knows where Stripe, Lemon Squeezy and Adyen state it.
 */
export function buyerEmailFromEvent(event: PaymentEvent): string | null {
  const raw = (event.raw ?? {}) as Record<string, any>
  const object = raw.data?.object ?? raw.data ?? raw
  const candidates = [
    object?.metadata?.email,
    object?.custom_data?.email,
    raw.meta?.custom_data?.email,
    object?.customer_details?.email,
    object?.customer_email,
    object?.receipt_email,
    object?.billing_details?.email,
    object?.attributes?.user_email,
    raw.additionalData?.shopperEmail,
  ]
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate)
    if (email)
      return email
  }
  return null
}

export type LicenseEventAction = 'issued' | 'existing' | 'refunded' | 'partially-refunded' | 'ignored'

export interface LicenseEventResult {
  action: LicenseEventAction
  license?: License
}

/**
 * Apply a verified payment event to licensing, from whichever driver verified
 * it. The framework's `POST /webhooks/payments` calls this for every event.
 *
 * - `checkout.completed` or `payment.succeeded` whose `merchantReference` is a
 *   {@link licensePurchaseReference}: the license is issued, once. A later
 *   event about the same purchase fills in what the first did not carry (the
 *   buyer's address, the payment's id) and sends the email if it could not be
 *   sent before.
 * - `refund.succeeded` for a license's payment: the refund is added, and the
 *   license is marked `refunded` once it covers what was paid.
 *
 * Anything else answers `ignored`.
 */
export async function handleLicensePaymentEvent(event: PaymentEvent, options?: LicensingOptions & { email?: string | null }): Promise<LicenseEventResult> {
  if (event.type === 'refund.succeeded')
    return applyRefund(event, options)
  if (event.type !== 'checkout.completed' && event.type !== 'payment.succeeded')
    return { action: 'ignored' }

  const purchase = parseLicensePurchaseReference(event.merchantReference)
  if (!purchase)
    return { action: 'ignored' }
  // A checkout can complete before its payment has (a bank debit): the paid
  // event that follows issues the license instead.
  const paymentStatus = (event.raw as any)?.data?.object?.payment_status
  if (event.type === 'checkout.completed' && paymentStatus === 'unpaid')
    return { action: 'ignored' }

  const reference = event.merchantReference!
  const email = normalizeEmail(options?.email) ?? buyerEmailFromEvent(event)
  const isPayment = event.type === 'payment.succeeded'

  const { license, created } = await issueLicense({
    purchaseReference: reference,
    tier: purchase.tier,
    seats: purchase.seats,
    productId: purchase.productId,
    email,
    provider: event.provider,
    paymentReference: event.reference,
    amountPaid: event.amount?.amount ?? null,
    currency: event.amount?.currency ?? null,
  }, options)
  if (created)
    return { action: 'issued', license }

  // The same purchase, seen again: keep what this event knows that the first did not.
  const patch: Record<string, unknown> = {}
  if (!license.email && email)
    patch.email = email
  // A payment's own id is what a refund will name, so it replaces a checkout's.
  if (event.reference && (isPayment ? license.paymentReference !== event.reference && license.provider === event.provider : !license.paymentReference))
    patch.payment_reference = event.reference
  if (license.amountPaid === null && event.amount) {
    patch.amount_paid = event.amount.amount
    patch.currency = event.amount.currency
  }
  if (!Object.keys(patch).length)
    return { action: 'existing', license }

  const { now, onIssued } = resolve(options)
  await db.updateTable('license_keys').set({ ...patch, updated_at: sqlDateTime(now()) }).where('id', '=', license.rowId).execute()
  const updated = toLicense((await rowById(license.rowId))!)
  if (patch.email && onIssued) {
    try {
      await onIssued(updated)
    }
    catch (error) {
      console.error(`[licensing] ${updated.key.slice(-4)}: could not send the license email: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { action: 'existing', license: updated }
}

async function applyRefund(event: PaymentEvent, options?: LicensingOptions): Promise<LicenseEventResult> {
  const { now } = resolve(options)
  let row: Record<string, any> | null = null
  if (event.reference)
    row = await db.selectFrom('license_keys').where('payment_reference', '=', event.reference).selectAll().executeTakeFirst() ?? null
  if (!row && parseLicensePurchaseReference(event.merchantReference))
    row = await db.selectFrom('license_keys').where('purchase_reference', '=', event.merchantReference).selectAll().executeTakeFirst() ?? null
  if (!row)
    return { action: 'ignored' }

  const licenseId = Number(row.id)
  let outcome: LicenseEventAction = 'ignored'
  await db.transaction(async (trx: any) => {
    // Recorded with the change it makes, so a provider's retry adds nothing.
    // The id is namespaced: commerce records the same event for its orders.
    const stamp = sqlDateTime(now())
    try {
      await trx.insertInto('payment_webhook_events').values({
        provider: event.provider,
        event_id: `license:${event.id}`.slice(0, 512),
        processed_at: stamp,
        created_at: stamp,
      }).execute()
    }
    catch (error) {
      if (isUniqueViolation(error))
        return
      throw error
    }

    const current = await rowById(licenseId, trx)
    if (!current || current.status === 'refunded')
      return
    const already = Number(current.amount_refunded ?? 0)
    const paid = numberOrNull(current.amount_paid)
    const stated = event.refundedTotal?.amount
    // A provider that states the running total has the difference applied.
    const total = stated !== undefined ? Math.max(stated, already) : already + (event.amount?.amount ?? 0)
    // With no amount on either side there is nothing to weigh: a refund is a refund.
    const full = paid === null || (stated === undefined && !event.amount) || total >= paid
    if (!full && total === already)
      return

    await trx.updateTable('license_keys').set({
      amount_refunded: total,
      ...(full ? { status: 'refunded', revoked_at: stamp } : {}),
      updated_at: stamp,
    }).where('id', '=', licenseId).execute()
    outcome = full ? 'refunded' : 'partially-refunded'
  })

  if (outcome === 'ignored')
    return { action: 'ignored' }
  const license = toLicense((await rowById(licenseId))!)
  if (outcome === 'refunded')
    await emit('license:revoked', license)
  return { action: outcome, license }
}

/** Why a license cannot be used right now, or null when it can. */
function blocked(license: License, at: Date): 'revoked' | 'refunded' | 'inactive' | 'expired' | null {
  if (license.status === 'revoked' || license.status === 'refunded' || license.status === 'inactive')
    return license.status
  if (license.expiresAt && at.getTime() > Date.parse(license.expiresAt))
    return 'expired'
  return null
}

const BLOCKED_MESSAGES = {
  'revoked': 'This license has been revoked.',
  'refunded': 'This license was refunded.',
  'inactive': 'This license is not active.',
  'expired': 'This license has expired.',
  'not-found': 'That license key was not found.',
} as const

function isTeam(license: License): boolean {
  return license.tier === 'team'
}

async function activeActivations(licenseId: number, seatId: number | null, trx: any = db): Promise<Array<Record<string, any>>> {
  let query = trx.selectFrom('license_activations').where('license_key_id', '=', licenseId).whereNull('released_at')
  if (seatId !== null)
    query = query.where('license_seat_id', '=', seatId)
  return await query.selectAll().execute()
}

function summary(license: License, devices: number): LicenseStandingSummary {
  return {
    id: license.id,
    tier: license.tier,
    status: license.status,
    updatesUntil: license.updatesUntil,
    expiresAt: license.expiresAt,
    maxDevices: license.maxDevices,
    devices,
    seats: license.seats,
  }
}

function sign(license: License, deviceHash: string, at: Date, key: LicenseSigningKey): string {
  return signLicenseToken({
    licenseId: license.id,
    tier: license.tier,
    updatesUntil: license.updatesUntil,
    expiresAt: license.expiresAt,
    deviceHash,
    issuedAt: at,
  }, key)
}

function clip(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

export interface ActivateLicenseInput {
  key: unknown
  /** SHA-256 of the device id, hex. */
  deviceHash: unknown
  deviceName?: unknown
  platform?: unknown
  appVersion?: unknown
  /** For a team license: the seat holder's address. */
  email?: unknown
}

export type ActivateLicenseResult =
  | { ok: true, key: string, token: string, license: LicenseStandingSummary }
  | {
    ok: false
    reason: 'not-found' | 'invalid-device' | 'revoked' | 'refunded' | 'inactive' | 'expired' | 'no-seat' | 'device-limit'
    message: string
    /** With `device-limit`: the devices holding the slots. */
    devices?: LicenseDeviceSummary[]
  }

/**
 * Activate a license on a device and answer with its token. Activating a
 * device that is already active refreshes it. Beyond `maxDevices` the answer
 * is `device-limit`, naming the devices in use so the owner knows which to
 * release.
 */
export async function activateLicense(input: ActivateLicenseInput, options?: LicensingOptions): Promise<ActivateLicenseResult> {
  const { now, signingKey } = resolve(options)
  const key = normalizeLicenseKey(input.key)
  if (!key)
    return { ok: false, reason: 'not-found', message: BLOCKED_MESSAGES['not-found'] }
  if (typeof input.deviceHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.deviceHash))
    return { ok: false, reason: 'invalid-device', message: 'A device is identified by the SHA-256 of its id.' }
  const deviceHash = input.deviceHash
  // Before anything is written: an activation the server cannot sign for is no activation.
  const signer = signingKey()
  const at = now()
  const stamp = sqlDateTime(at)

  return await db.transaction(async (trx: any): Promise<ActivateLicenseResult> => {
    const row = await rowByKey(key, trx)
    if (!row)
      return { ok: false, reason: 'not-found', message: BLOCKED_MESSAGES['not-found'] }
    let license = toLicense(row)
    const reason = blocked(license, at)
    if (reason)
      return { ok: false, reason, message: BLOCKED_MESSAGES[reason] }

    let seatId: number | null = null
    if (isTeam(license)) {
      const email = normalizeEmail(input.email)
      const seat = email
        ? await trx.selectFrom('license_seats').where('license_key_id', '=', license.rowId).where('email', '=', email).selectAll().executeTakeFirst()
        : null
      if (!seat)
        return { ok: false, reason: 'no-seat', message: 'This is a team license. Ask the team\'s owner to assign you a seat, then activate with that address.' }
      seatId = Number(seat.id)
    }

    const existing = await trx.selectFrom('license_activations')
      .where('license_key_id', '=', license.rowId)
      .where('device_hash', '=', deviceHash)
      .selectAll()
      .executeTakeFirst()
    const others = (await activeActivations(license.rowId, seatId, trx)).filter(activation => activation.device_hash !== deviceHash)
    if (others.length >= license.maxDevices) {
      const devices = others.map(activation => ({
        name: activation.device_name ?? null,
        platform: activation.platform ?? null,
        lastSeenAt: isoOrNull(activation.last_seen_at),
      }))
      const names = devices.map(device => device.name || 'an unnamed device').join(' and ')
      return {
        ok: false,
        reason: 'device-limit',
        message: `This license is already in use on ${devices.length} ${devices.length === 1 ? 'device' : 'devices'}: ${names}. Release one of them to activate here.`,
        devices,
      }
    }

    const fields = {
      device_name: clip(input.deviceName, 255),
      platform: clip(input.platform, 32),
      app_version: clip(input.appVersion, 64),
      license_seat_id: seatId,
      last_seen_at: stamp,
      released_at: null,
      updated_at: stamp,
    }
    if (existing) {
      await trx.updateTable('license_activations').set(fields).where('id', '=', existing.id).execute()
    }
    else {
      await trx.insertInto('license_activations').values({
        ...fields,
        license_key_id: license.rowId,
        device_hash: deviceHash,
        first_seen_at: stamp,
        created_at: stamp,
      }).execute()
    }

    // A key from a pool that nobody had used yet is in use from here on.
    if (license.status === 'unassigned') {
      await trx.updateTable('license_keys').set({ status: 'active', updated_at: stamp }).where('id', '=', license.rowId).execute()
      license = { ...license, status: 'active' }
    }

    return { ok: true, key: license.key, token: sign(license, deviceHash, at, signer), license: summary(license, others.length + 1) }
  })
}

/** Release a device's slot. `released` is false when it held none. */
export async function deactivateLicense(input: { key: unknown, deviceHash: unknown }, options?: LicensingOptions): Promise<{ ok: boolean, released: boolean }> {
  const { now } = resolve(options)
  const license = await findLicenseByKey(input.key)
  if (!license || typeof input.deviceHash !== 'string')
    return { ok: false, released: false }
  const activation = await db.selectFrom('license_activations')
    .where('license_key_id', '=', license.rowId)
    .where('device_hash', '=', input.deviceHash)
    .whereNull('released_at')
    .selectAll()
    .executeTakeFirst()
  if (!activation)
    return { ok: true, released: false }
  const stamp = sqlDateTime(now())
  await db.updateTable('license_activations').set({ released_at: stamp, updated_at: stamp }).where('id', '=', activation.id).execute()
  return { ok: true, released: true }
}

export type CheckLicenseResult =
  | { valid: true, token: string, license: LicenseStandingSummary }
  | { valid: false, reason: 'not-found' | 'revoked' | 'refunded' | 'inactive' | 'expired' | 'released', message: string }

/**
 * Where a license stands for a device that activated it, with a fresh token
 * when it is good. `released` means this device holds no slot (it was
 * released, or never activated) and has to activate again.
 */
export async function checkLicense(input: { key: unknown, deviceHash: unknown, appVersion?: unknown }, options?: LicensingOptions): Promise<CheckLicenseResult> {
  const { now, signingKey } = resolve(options)
  const license = await findLicenseByKey(input.key)
  if (!license)
    return { valid: false, reason: 'not-found', message: BLOCKED_MESSAGES['not-found'] }
  const at = now()
  const reason = blocked(license, at)
  if (reason)
    return { valid: false, reason, message: BLOCKED_MESSAGES[reason] }

  const activation = typeof input.deviceHash === 'string'
    ? await db.selectFrom('license_activations')
        .where('license_key_id', '=', license.rowId)
        .where('device_hash', '=', input.deviceHash)
        .whereNull('released_at')
        .selectAll()
        .executeTakeFirst()
    : null
  if (!activation)
    return { valid: false, reason: 'released', message: 'This device is not activated on this license.' }

  const signer = signingKey()
  const stamp = sqlDateTime(at)
  const appVersion = clip(input.appVersion, 64)
  await db.updateTable('license_activations')
    .set({ last_seen_at: stamp, updated_at: stamp, ...(appVersion ? { app_version: appVersion } : {}) })
    .where('id', '=', activation.id)
    .execute()

  const seatId = numberOrNull(activation.license_seat_id)
  const devices = (await activeActivations(license.rowId, isTeam(license) ? seatId : null)).length
  return { valid: true, token: sign(license, String(activation.device_hash), at, signer), license: summary(license, devices) }
}

/** The devices active on a license, for an account page. */
export async function licenseDevices(rawKey: unknown): Promise<LicenseDeviceSummary[]> {
  const license = await findLicenseByKey(rawKey)
  if (!license)
    return []
  return (await activeActivations(license.rowId, null)).map(activation => ({
    name: activation.device_name ?? null,
    platform: activation.platform ?? null,
    lastSeenAt: isoOrNull(activation.last_seen_at),
  }))
}

/** Stop a license working: `revoked` by hand, or `refunded`. Its devices learn at their next check. */
export async function revokeLicense(rawKey: unknown, options?: LicensingOptions & { status?: 'revoked' | 'refunded' }): Promise<License | null> {
  const { now } = resolve(options)
  const license = await findLicenseByKey(rawKey)
  if (!license)
    return null
  const stamp = sqlDateTime(now())
  await db.updateTable('license_keys').set({ status: options?.status ?? 'revoked', revoked_at: stamp, updated_at: stamp }).where('id', '=', license.rowId).execute()
  const revoked = toLicense((await rowById(license.rowId))!)
  await emit('license:revoked', revoked)
  return revoked
}

/** Move a team license's end, and a standard license's updates, on renewal. */
export async function extendLicense(rawKey: unknown, until: Date, options?: LicensingOptions): Promise<License | null> {
  const { now } = resolve(options)
  const license = await findLicenseByKey(rawKey)
  if (!license)
    return null
  const column = license.expiresAt ? 'expiry_date' : license.updatesUntil ? 'updates_until' : null
  if (!column)
    return license
  await db.updateTable('license_keys').set({ [column]: sqlDateTime(until), updated_at: sqlDateTime(now()) }).where('id', '=', license.rowId).execute()
  return toLicense((await rowById(license.rowId))!)
}

export type TransferLicenseResult =
  | { ok: true, license: License }
  | { ok: false, reason: 'not-found' | 'not-owner' | 'invalid-email' | 'revoked' | 'refunded' | 'inactive' | 'expired', message: string }

/**
 * Hand a license to another person. The caller proves they own it by naming
 * the address it is registered to; every device is released, so the new owner
 * starts with all of its slots, and later resends go to the new address.
 */
export async function transferLicense(input: { key: unknown, fromEmail: unknown, toEmail: unknown }, options?: LicensingOptions): Promise<TransferLicenseResult> {
  const { now, onIssued } = resolve(options)
  const license = await findLicenseByKey(input.key)
  const from = normalizeEmail(input.fromEmail)
  // One answer for "no such key" and "not yours", so a key cannot be probed for its owner.
  if (!license || !from || license.email !== from)
    return { ok: false, reason: license ? 'not-owner' : 'not-found', message: 'That key and address do not match a license.' }
  const to = normalizeEmail(input.toEmail)
  if (!to)
    return { ok: false, reason: 'invalid-email', message: 'The new owner needs a valid email address.' }
  const at = now()
  const reason = blocked(license, at)
  if (reason)
    return { ok: false, reason, message: BLOCKED_MESSAGES[reason] }

  const stamp = sqlDateTime(at)
  await db.transaction(async (trx: any) => {
    await trx.updateTable('license_keys').set({ email: to, customer_id: null, updated_at: stamp }).where('id', '=', license.rowId).execute()
    await trx.updateTable('license_activations').set({ released_at: stamp, updated_at: stamp }).where('license_key_id', '=', license.rowId).whereNull('released_at').execute()
  })
  const moved = toLicense((await rowById(license.rowId))!)
  await emit('license:transferred', moved)
  if (onIssued) {
    try {
      await onIssued(moved)
    }
    catch (error) {
      console.error(`[licensing] ${moved.key.slice(-4)}: could not send the license email: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { ok: true, license: moved }
}

/** The licenses registered to an address that are good right now, for sending their keys again. */
export async function activeLicensesFor(rawEmail: unknown, options?: LicensingOptions): Promise<License[]> {
  const { now } = resolve(options)
  const email = normalizeEmail(rawEmail)
  if (!email)
    return []
  const rows = await db.selectFrom('license_keys').where('email', '=', email).selectAll().execute() as Array<Record<string, any>>
  const at = now()
  return rows.map(toLicense).filter(license => license.status === 'active' && !blocked(license, at))
}

function toSeat(row: Record<string, any>): LicenseSeatSummary {
  return {
    userId: Number(row.user_id),
    teamMemberId: numberOrNull(row.team_member_id),
    email: String(row.email),
    assignedAt: isoOrNull(row.assigned_at),
  }
}

/** Who holds a seat on a team license. */
export async function licenseSeats(rawKey: unknown): Promise<LicenseSeatSummary[]> {
  const license = await findLicenseByKey(rawKey)
  if (!license)
    return []
  const rows = await db.selectFrom('license_seats').where('license_key_id', '=', license.rowId).selectAll().execute() as Array<Record<string, any>>
  return rows.map(toSeat)
}

export type AssignSeatResult =
  | { ok: true, seat: LicenseSeatSummary }
  | { ok: false, reason: 'not-found' | 'not-a-team-license' | 'not-a-member' | 'seat-limit', message: string }

/**
 * Give a member of the license's team a seat. The member must be an active
 * `TeamMember` of the `Team` the license belongs to; assigning someone who
 * already has a seat answers with it. Beyond `seats` the answer is
 * `seat-limit`.
 */
export async function assignLicenseSeat(input: { key: unknown, userId: number }, options?: LicensingOptions): Promise<AssignSeatResult> {
  const { now } = resolve(options)
  const license = await findLicenseByKey(input.key)
  if (!license)
    return { ok: false, reason: 'not-found', message: BLOCKED_MESSAGES['not-found'] }
  if (!isTeam(license) || !license.teamId)
    return { ok: false, reason: 'not-a-team-license', message: 'Seats are assigned on a team license that belongs to a team.' }

  const userId = Number(input.userId)
  return await db.transaction(async (trx: any): Promise<AssignSeatResult> => {
    const member = await trx.selectFrom('team_members')
      .where('team_id', '=', license.teamId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .selectAll()
      .executeTakeFirst()
    const user = member ? await trx.selectFrom('users').where('id', '=', userId).select(['id', 'email']).executeTakeFirst() : null
    const email = normalizeEmail(user?.email)
    if (!member || !email)
      return { ok: false, reason: 'not-a-member', message: 'Only an active member of the license\'s team can hold a seat.' }

    const seats = await trx.selectFrom('license_seats').where('license_key_id', '=', license.rowId).selectAll().execute() as Array<Record<string, any>>
    const held = seats.find(seat => Number(seat.user_id) === userId)
    if (held)
      return { ok: true, seat: toSeat(held) }
    if (seats.length >= license.seats)
      return { ok: false, reason: 'seat-limit', message: `All ${license.seats} ${license.seats === 1 ? 'seat is' : 'seats are'} assigned. Free one, or add seats to the license.` }

    const stamp = sqlDateTime(now())
    await trx.insertInto('license_seats').values({
      license_key_id: license.rowId,
      team_member_id: member.id,
      user_id: userId,
      email,
      assigned_at: stamp,
      created_at: stamp,
      updated_at: stamp,
    }).execute()
    const seat = await trx.selectFrom('license_seats').where('license_key_id', '=', license.rowId).where('user_id', '=', userId).selectAll().executeTakeFirst()
    return { ok: true, seat: toSeat(seat) }
  })
}

/** Take a member's seat back, releasing the devices activated under it. */
export async function unassignLicenseSeat(input: { key: unknown, userId: number }, options?: LicensingOptions): Promise<{ ok: boolean, removed: boolean }> {
  const { now } = resolve(options)
  const license = await findLicenseByKey(input.key)
  if (!license)
    return { ok: false, removed: false }
  return await db.transaction(async (trx: any) => {
    const seat = await trx.selectFrom('license_seats').where('license_key_id', '=', license.rowId).where('user_id', '=', Number(input.userId)).selectAll().executeTakeFirst()
    if (!seat)
      return { ok: true, removed: false }
    const stamp = sqlDateTime(now())
    await trx.updateTable('license_activations')
      .set({ released_at: stamp, updated_at: stamp })
      .where('license_key_id', '=', license.rowId)
      .where('license_seat_id', '=', seat.id)
      .whereNull('released_at')
      .execute()
    await trx.deleteFrom('license_seats').where('id', '=', seat.id).execute()
    return { ok: true, removed: true }
  })
}
