import type { PaymentDriver, PaymentEvent } from '@stacksjs/payments'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database/runtime'
import {
  activateLicense,
  activeLicensesFor,
  assignLicenseSeat,
  checkLicense,
  deactivateLicense,
  findLicenseByKey,
  generateLicenseKey,
  handleLicensePaymentEvent,
  issueLicense,
  licensePurchaseReference,
  licenseSeats,
  normalizeLicenseKey,
  parseLicensePurchaseReference,
  registerDefaultLicenseMailer,
  requestLicenseResend,
  revokeLicense,
  transferLicense,
  unassignLicenseSeat,
} from '../licensing'
import { receivePaymentWebhook } from '../orders/webhook'
import { store as storeLicenseKey } from '../shippings/license-keys/store'
import { generateLicenseSigningKeypair, hashDeviceId, isEntitled, verifyLicenseToken } from '../licensing/token'
import { refreshDatabase } from './setup'

const keys = generateLicenseSigningKeypair('test-key')
const trusted = { [keys.keyId]: keys.publicKey }
const now = new Date('2026-11-11T12:00:00.000Z')
const options = { signingKey: keys, now: () => now }

const laptop = hashDeviceId('laptop')
const desktop = hashDeviceId('desktop')
const tablet = hashDeviceId('tablet')

function event(overrides: Partial<PaymentEvent>): PaymentEvent {
  return {
    provider: 'stripe',
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: 'payment.succeeded',
    providerType: 'payment_intent.succeeded',
    reference: 'pi_1',
    merchantReference: null,
    amount: { amount: 3900, currency: 'usd' },
    reason: null,
    raw: {},
    ...overrides,
  }
}

async function standard(email = 'buyer@example.com') {
  const { license } = await issueLicense({ purchaseReference: licensePurchaseReference({ tier: 'standard' }), tier: 'standard', email }, options)
  return license
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('license keys', () => {
  it('generates keys the model accepts and normalizes what people type', () => {
    const key = generateLicenseKey()
    expect(key).toMatch(/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){4}$/)
    expect(normalizeLicenseKey(` ${key.toLowerCase().replaceAll('-', ' ')} `)).toBe(key)
    expect(normalizeLicenseKey('nope')).toBeNull()
    expect(normalizeLicenseKey(42)).toBeNull()
  })

  it('round-trips a purchase reference a provider will carry', () => {
    const reference = licensePurchaseReference({ tier: 'team', seats: 5, productId: 12 })
    expect(reference).toMatch(/^[\w-]{1,200}$/)
    expect(parseLicensePurchaseReference(reference)).toEqual({ tier: 'team', seats: 5, productId: 12 })
    expect(parseLicensePurchaseReference('order-1042')).toBeNull()
    expect(parseLicensePurchaseReference(null)).toBeNull()
  })
})

describe('issuing', () => {
  it('issues a standard license with a year of updates and two devices', async () => {
    const license = await standard()

    expect(license).toMatchObject({
      tier: 'standard',
      status: 'active',
      email: 'buyer@example.com',
      maxDevices: 2,
      seats: 1,
      expiresAt: null,
      updatesUntil: '2027-11-11T12:00:00.000Z',
    })
    expect(normalizeLicenseKey(license.key)).toBe(license.key)
  })

  it('issues a lifetime license with no end to its updates', async () => {
    const { license } = await issueLicense({ purchaseReference: 'lifetime-1', tier: 'lifetime', email: 'buyer@example.com' }, options)
    expect(license).toMatchObject({ tier: 'lifetime', updatesUntil: null, expiresAt: null })
    expect(isEntitled(license, '2099-01-01T00:00:00.000Z')).toBe(true)
  })

  it('is idempotent per purchase', async () => {
    const first = await issueLicense({ purchaseReference: 'purchase-1', tier: 'standard', email: 'buyer@example.com' }, options)
    const second = await issueLicense({ purchaseReference: 'purchase-1', tier: 'standard', email: 'buyer@example.com' }, options)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.license.key).toBe(first.license.key)
    expect(await db.selectFrom('license_keys').selectAll().execute()).toHaveLength(1)
  })

  it('tells onIssued once, and survives it failing', async () => {
    const told: string[] = []
    const onIssued = async (license: { key: string }) => {
      told.push(license.key)
      throw new Error('mail is down')
    }
    const first = await issueLicense({ purchaseReference: 'purchase-2', tier: 'standard', email: 'buyer@example.com' }, { ...options, onIssued })
    await issueLicense({ purchaseReference: 'purchase-2', tier: 'standard', email: 'buyer@example.com' }, { ...options, onIssued })

    expect(told).toEqual([first.license.key])
  })

  it('issues from a payment event of any driver, once across its events', async () => {
    const reference = licensePurchaseReference({ tier: 'standard' })
    const paid = await handleLicensePaymentEvent(event({ merchantReference: reference, reference: 'pi_9' }), options)
    const completed = await handleLicensePaymentEvent(event({
      type: 'checkout.completed',
      providerType: 'checkout.session.completed',
      reference: 'cs_9',
      merchantReference: reference,
      raw: { data: { object: { customer_details: { email: 'Buyer@Example.com' } } } },
    }), options)
    const retried = await handleLicensePaymentEvent(event({ merchantReference: reference, reference: 'pi_9', provider: 'adyen' }), options)

    expect(paid.action).toBe('issued')
    expect(completed.action).toBe('existing')
    expect(retried.action).toBe('existing')

    const rows = await db.selectFrom('license_keys').selectAll().execute()
    expect(rows).toHaveLength(1)
    expect(completed.license).toMatchObject({
      key: paid.license!.key,
      email: 'buyer@example.com',
      provider: 'stripe',
      paymentReference: 'pi_9',
      amountPaid: 3900,
      currency: 'usd',
    })
  })

  it('leaves an event that is not a license purchase alone', async () => {
    expect((await handleLicensePaymentEvent(event({ merchantReference: 'order-1042' }), options)).action).toBe('ignored')
    expect((await handleLicensePaymentEvent(event({ type: 'payment.failed', merchantReference: licensePurchaseReference({ tier: 'standard' }) }), options)).action).toBe('ignored')
    expect(await db.selectFrom('license_keys').selectAll().execute()).toHaveLength(0)
  })
})

describe('the payment webhook', () => {
  it('issues a license for a paid license checkout and emails the key once', async () => {
    const mailed: Array<string | null> = []
    registerDefaultLicenseMailer((license) => { mailed.push(license.email) })

    const reference = licensePurchaseReference({ tier: 'lifetime' })
    const completed = event({
      id: 'evt_checkout',
      type: 'checkout.completed',
      reference: 'cs_1',
      merchantReference: reference,
      amount: { amount: 14900, currency: 'usd' },
      raw: { data: { object: { customer_details: { email: 'buyer@example.com' } } } },
    })
    const driver = {
      verifyWebhook: async () => [completed],
      acknowledgeWebhook: () => new Response('ok'),
    } as unknown as PaymentDriver
    const deliver = () => receivePaymentWebhook(new Request('https://app.test/webhooks/payments', { method: 'POST', body: '{}' }), driver)

    expect((await deliver()).status).toBe(200)
    expect((await deliver()).status).toBe(200)

    const rows = await db.selectFrom('license_keys').selectAll().execute() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ tier: 'lifetime', status: 'active', email: 'buyer@example.com', amount_paid: 14900, purchase_reference: reference })
    expect(mailed).toEqual(['buyer@example.com'])
    registerDefaultLicenseMailer(() => {})
  })
})

describe('license key records', () => {
  it('stores a key with no expiry, for a license that never ends', async () => {
    const stored = await storeLicenseKey({ key: generateLicenseKey(), template: 'Premium License', status: 'unassigned' } as never) as Record<string, unknown>
    expect(stored.expiry_date ?? stored.expiryDate ?? null).toBeNull()
  })

  it('makes a key from the pool active on its first activation', async () => {
    const key = generateLicenseKey()
    await storeLicenseKey({ key, template: 'Standard License', status: 'unassigned' } as never)

    expect((await activateLicense({ key, deviceHash: laptop }, options)).ok).toBe(true)
    expect(await findLicenseByKey(key)).toMatchObject({ status: 'active', tier: 'standard', maxDevices: 2 })
  })
})

describe('activating', () => {
  it('activates a device and answers with a token that verifies', async () => {
    const license = await standard()
    const result = await activateLicense({ key: license.key.toLowerCase(), deviceHash: laptop, deviceName: 'Laptop', platform: 'darwin', appVersion: '1.0.0' }, options)

    if (!result.ok)
      throw new Error(result.message)
    const payload = verifyLicenseToken(result.token, trusted, laptop)
    expect(payload).toMatchObject({
      licenseId: license.id,
      tier: 'standard',
      updatesUntil: '2027-11-11T12:00:00.000Z',
      expiresAt: null,
      issuedAt: '2026-11-11T12:00:00.000Z',
      checkBy: '2026-12-11T12:00:00.000Z',
    })
    expect(JSON.stringify(payload)).not.toContain(license.key)
  })

  it('refuses a third device and names the two in use', async () => {
    const license = await standard()
    await activateLicense({ key: license.key, deviceHash: laptop, deviceName: 'Laptop', platform: 'darwin' }, options)
    await activateLicense({ key: license.key, deviceHash: desktop, deviceName: 'Desktop', platform: 'win32' }, options)
    const third = await activateLicense({ key: license.key, deviceHash: tablet, deviceName: 'Tablet' }, options)

    expect(third.ok).toBe(false)
    if (third.ok)
      return
    expect(third.reason).toBe('device-limit')
    expect(third.devices?.map(device => device.name).sort()).toEqual(['Desktop', 'Laptop'])
    expect(third.message).toContain('Desktop')
    expect(third.message).toContain('Laptop')
  })

  it('lets an active device activate again without using another slot', async () => {
    const license = await standard()
    await activateLicense({ key: license.key, deviceHash: laptop, deviceName: 'Laptop' }, options)
    await activateLicense({ key: license.key, deviceHash: desktop, deviceName: 'Desktop' }, options)

    expect((await activateLicense({ key: license.key, deviceHash: laptop, deviceName: 'Laptop' }, options)).ok).toBe(true)
    expect(await db.selectFrom('license_activations').selectAll().execute()).toHaveLength(2)
  })

  it('frees a slot when a device is released', async () => {
    const license = await standard()
    await activateLicense({ key: license.key, deviceHash: laptop, deviceName: 'Laptop' }, options)
    await activateLicense({ key: license.key, deviceHash: desktop, deviceName: 'Desktop' }, options)

    expect(await deactivateLicense({ key: license.key, deviceHash: laptop }, options)).toEqual({ ok: true, released: true })
    expect((await activateLicense({ key: license.key, deviceHash: tablet, deviceName: 'Tablet' }, options)).ok).toBe(true)

    // The released device is no longer licensed, and cannot come back while the slots are full.
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'released' })
    expect(await activateLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ ok: false, reason: 'device-limit' })
  })

  it('answers not-found for a key that does not exist', async () => {
    expect(await activateLicense({ key: generateLicenseKey(), deviceHash: laptop }, options)).toMatchObject({ ok: false, reason: 'not-found' })
    expect(await activateLicense({ key: 'junk', deviceHash: laptop }, options)).toMatchObject({ ok: false, reason: 'not-found' })
  })

  it('refuses a device hash that is not a SHA-256', async () => {
    const license = await standard()
    expect(await activateLicense({ key: license.key, deviceHash: 'laptop' }, options)).toMatchObject({ ok: false, reason: 'invalid-device' })
  })
})

describe('checking', () => {
  it('answers standing and a fresh token, and records the visit', async () => {
    const license = await standard()
    await activateLicense({ key: license.key, deviceHash: laptop, appVersion: '1.0.0' }, options)

    const later = new Date('2026-11-20T12:00:00.000Z')
    const result = await checkLicense({ key: license.key, deviceHash: laptop, appVersion: '1.1.0' }, { ...options, now: () => later })

    expect(result).toMatchObject({ valid: true, license: { tier: 'standard', status: 'active', devices: 1, maxDevices: 2 } })
    if (!result.valid)
      return
    expect(verifyLicenseToken(result.token, trusted, laptop).issuedAt).toBe('2026-11-20T12:00:00.000Z')

    const activation = await db.selectFrom('license_activations').selectAll().executeTakeFirst() as Record<string, unknown>
    expect(activation.app_version).toBe('1.1.0')
    expect(String(activation.last_seen_at)).toContain('2026-11-20')
    expect(String(activation.first_seen_at)).toContain('2026-11-11')
  })

  it('answers not valid for a device that never activated', async () => {
    const license = await standard()
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'released' })
  })
})

describe('refunds and revocation', () => {
  it('revokes the license when its payment is refunded in full', async () => {
    const reference = licensePurchaseReference({ tier: 'standard' })
    const { license } = await handleLicensePaymentEvent(event({ merchantReference: reference, reference: 'pi_7' }), options)
    await activateLicense({ key: license!.key, deviceHash: laptop }, options)

    const refund = await handleLicensePaymentEvent(event({ type: 'refund.succeeded', providerType: 'charge.refunded', reference: 'pi_7', amount: { amount: 3900, currency: 'usd' } }), options)

    expect(refund.action).toBe('refunded')
    expect(refund.license).toMatchObject({ status: 'refunded', amountRefunded: 3900 })
    expect(await checkLicense({ key: license!.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'refunded' })
    expect(await activateLicense({ key: license!.key, deviceHash: desktop }, options)).toMatchObject({ ok: false, reason: 'refunded' })
  })

  it('keeps the license through a partial refund, and applies a retry once', async () => {
    const reference = licensePurchaseReference({ tier: 'standard' })
    const { license } = await handleLicensePaymentEvent(event({ merchantReference: reference, reference: 'pi_8' }), options)

    const partial = event({ id: 'evt_refund_1', type: 'refund.succeeded', reference: 'pi_8', amount: { amount: 1000, currency: 'usd' } })
    expect((await handleLicensePaymentEvent(partial, options)).action).toBe('partially-refunded')
    expect((await handleLicensePaymentEvent(partial, options)).action).toBe('ignored')
    expect(await findLicenseByKey(license!.key)).toMatchObject({ status: 'active', amountRefunded: 1000 })

    const rest = event({ id: 'evt_refund_2', type: 'refund.succeeded', reference: 'pi_8', amount: { amount: 2900, currency: 'usd' } })
    expect((await handleLicensePaymentEvent(rest, options)).action).toBe('refunded')
  })

  it('finds the license by the purchase reference when the refund carries it', async () => {
    const reference = licensePurchaseReference({ tier: 'lifetime' })
    await handleLicensePaymentEvent(event({ type: 'checkout.completed', merchantReference: reference, reference: 'cs_3', amount: { amount: 14900, currency: 'usd' } }), options)

    const refund = await handleLicensePaymentEvent(event({ type: 'refund.succeeded', reference: 'pi_unseen', merchantReference: reference, amount: null, refundedTotal: { amount: 14900, currency: 'usd' } }), options)
    expect(refund.action).toBe('refunded')
  })

  it('revokes by hand', async () => {
    const license = await standard()
    await activateLicense({ key: license.key, deviceHash: laptop }, options)

    expect(await revokeLicense(license.key, options)).toMatchObject({ status: 'revoked' })
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'revoked' })
  })
})

describe('transfer', () => {
  it('moves the license to a new address and releases its devices', async () => {
    const license = await standard('first@example.com')
    await activateLicense({ key: license.key, deviceHash: laptop }, options)

    expect(await transferLicense({ key: license.key, fromEmail: 'someone-else@example.com', toEmail: 'second@example.com' }, options)).toMatchObject({ ok: false, reason: 'not-owner' })

    const moved = await transferLicense({ key: license.key, fromEmail: 'First@example.com', toEmail: 'second@example.com' }, options)
    expect(moved).toMatchObject({ ok: true, license: { email: 'second@example.com' } })
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'released' })
    expect(await activeLicensesFor('first@example.com', options)).toHaveLength(0)
    expect(await activeLicensesFor('second@example.com', options)).toHaveLength(1)
  })
})

describe('team seats', () => {
  async function team() {
    const stamp = '2026-11-01 00:00:00'
    await db.insertInto('teams').values({ id: 1, name: 'Studio', member_count: 3, created_at: stamp }).execute()
    for (const [id, email] of [[1, 'ada@example.com'], [2, 'grace@example.com'], [3, 'linus@example.com']] as const) {
      await db.insertInto('users').values({ id, name: email, email, password: 'x', created_at: stamp }).execute()
      await db.insertInto('team_members').values({ id, team_id: 1, user_id: id, role: 'member', status: 'active', created_at: stamp }).execute()
    }
    await db.insertInto('users').values({ id: 9, name: 'outsider', email: 'outsider@example.com', password: 'x', created_at: stamp }).execute()
    const { license } = await issueLicense({ purchaseReference: 'team-1', tier: 'team', seats: 2, email: 'ada@example.com', teamId: 1 }, options)
    return license
  }

  it('issues a team license that runs for a year', async () => {
    const license = await team()
    expect(license).toMatchObject({ tier: 'team', seats: 2, teamId: 1, updatesUntil: null, expiresAt: '2027-11-11T12:00:00.000Z' })
  })

  it('assigns seats to team members up to the seat count', async () => {
    const license = await team()

    expect(await assignLicenseSeat({ key: license.key, userId: 1 }, options)).toMatchObject({ ok: true, seat: { email: 'ada@example.com' } })
    expect(await assignLicenseSeat({ key: license.key, userId: 1 }, options)).toMatchObject({ ok: true })
    expect(await assignLicenseSeat({ key: license.key, userId: 2 }, options)).toMatchObject({ ok: true })

    const third = await assignLicenseSeat({ key: license.key, userId: 3 }, options)
    expect(third).toMatchObject({ ok: false, reason: 'seat-limit' })
    expect((await licenseSeats(license.key)).map(seat => seat.email).sort()).toEqual(['ada@example.com', 'grace@example.com'])
  })

  it('refuses a seat for someone outside the team', async () => {
    const license = await team()
    expect(await assignLicenseSeat({ key: license.key, userId: 9 }, options)).toMatchObject({ ok: false, reason: 'not-a-member' })
  })

  it('activates only for a seat holder, with the device limit per seat', async () => {
    const license = await team()
    await assignLicenseSeat({ key: license.key, userId: 1 }, options)
    await assignLicenseSeat({ key: license.key, userId: 2 }, options)

    expect(await activateLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ ok: false, reason: 'no-seat' })
    expect(await activateLicense({ key: license.key, deviceHash: laptop, email: 'linus@example.com' }, options)).toMatchObject({ ok: false, reason: 'no-seat' })

    expect((await activateLicense({ key: license.key, deviceHash: laptop, email: 'Ada@example.com' }, options)).ok).toBe(true)
    expect((await activateLicense({ key: license.key, deviceHash: desktop, email: 'ada@example.com' }, options)).ok).toBe(true)
    expect(await activateLicense({ key: license.key, deviceHash: tablet, email: 'ada@example.com' }, options)).toMatchObject({ ok: false, reason: 'device-limit' })
    // Another seat has its own two devices.
    expect((await activateLicense({ key: license.key, deviceHash: tablet, email: 'grace@example.com' }, options)).ok).toBe(true)
  })

  it('frees a seat and its devices when unassigned', async () => {
    const license = await team()
    await assignLicenseSeat({ key: license.key, userId: 1 }, options)
    await assignLicenseSeat({ key: license.key, userId: 2 }, options)
    await activateLicense({ key: license.key, deviceHash: laptop, email: 'ada@example.com' }, options)

    expect(await unassignLicenseSeat({ key: license.key, userId: 1 }, options)).toEqual({ ok: true, removed: true })
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, options)).toMatchObject({ valid: false, reason: 'released' })
    expect(await assignLicenseSeat({ key: license.key, userId: 3 }, options)).toMatchObject({ ok: true })
  })

  it('ends a team license when its year is over', async () => {
    const license = await team()
    await assignLicenseSeat({ key: license.key, userId: 1 }, options)
    await activateLicense({ key: license.key, deviceHash: laptop, email: 'ada@example.com' }, options)

    const nextYear = { ...options, now: () => new Date('2027-11-12T00:00:00.000Z') }
    expect(await checkLicense({ key: license.key, deviceHash: laptop }, nextYear)).toMatchObject({ valid: false, reason: 'expired' })
  })
})

describe('resend by email', () => {
  function deps(overrides: Partial<Parameters<typeof requestLicenseResend>[1]> = {}) {
    const sent: string[][] = []
    const counts = new Map<string, number>()
    return {
      sent,
      deps: {
        allow: async (bucket: 'ip' | 'email', identity?: string) => {
          const name = `${bucket}:${identity ?? ''}`
          counts.set(name, (counts.get(name) ?? 0) + 1)
          return counts.get(name)! <= (bucket === 'ip' ? 10 : 3)
        },
        active: (email: string) => activeLicensesFor(email, options),
        send: async (licenses: Array<{ key: string }>) => { sent.push(licenses.map(license => license.key)) },
        ...overrides,
      },
    }
  }

  it('sends the keys that are still good to the address that bought them', async () => {
    const good = await standard('buyer@example.com')
    const revoked = await standard('buyer@example.com')
    await revokeLicense(revoked.key, options)
    await standard('other@example.com')

    const { sent, deps: resend } = deps()
    const request = await requestLicenseResend(' Buyer@Example.com ', resend)
    await request.delivery

    expect(request.outcome).toBe('accepted')
    expect(sent).toEqual([[good.key]])
  })

  it('answers the same for an address that bought nothing, and sends nothing', async () => {
    const { sent, deps: resend } = deps()
    const request = await requestLicenseResend('nobody@example.com', resend)
    await request.delivery

    expect(request.outcome).toBe('accepted')
    expect(sent).toEqual([])
  })

  it('limits requests per address and refuses what is not an address', async () => {
    await standard('buyer@example.com')
    const { sent, deps: resend } = deps()

    expect((await requestLicenseResend('not an address', resend)).outcome).toBe('invalid')
    const outcomes = []
    for (let i = 0; i < 4; i++) {
      const request = await requestLicenseResend('buyer@example.com', resend)
      await request.delivery
      outcomes.push(request.outcome)
    }
    expect(outcomes).toEqual(['accepted', 'accepted', 'accepted', 'limited'])
    expect(sent).toHaveLength(3)
  })
})
