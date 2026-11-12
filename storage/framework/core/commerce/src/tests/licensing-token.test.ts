import { describe, expect, it } from 'bun:test'
import type { LicenseStorage } from '../licensing/client'
import { createLicenseClient, verifyToken } from '../licensing/client'
import {
  generateLicenseSigningKeypair,
  hashDeviceId,
  isEntitled,
  LicenseTokenError,
  signLicenseToken,
  tokenStanding,
  verifyLicenseToken,
} from '../licensing/token'

const DAY = 24 * 60 * 60 * 1000
const keys = generateLicenseSigningKeypair('test-key')
const trusted = { [keys.keyId]: keys.publicKey }
const device = hashDeviceId('device-one')
const issuedAt = new Date('2026-11-01T00:00:00.000Z')

function token(overrides: Partial<Parameters<typeof signLicenseToken>[0]> = {}): string {
  return signLicenseToken({
    licenseId: 'lic-1',
    tier: 'standard',
    updatesUntil: '2027-11-01T00:00:00.000Z',
    deviceHash: device,
    issuedAt,
    ...overrides,
  }, keys)
}

function failure(run: () => unknown): string {
  try {
    run()
  }
  catch (error) {
    if (error instanceof LicenseTokenError)
      return error.reason
    throw error
  }
  return 'no error'
}

describe('license signing keys', () => {
  it('encodes a keypair the way the desktop updater encodes its keys', () => {
    expect(keys.publicKey.startsWith('ed25519-public:')).toBe(true)
    expect(keys.privateKey.startsWith('ed25519-private:')).toBe(true)
    expect(() => generateLicenseSigningKeypair('not a key id')).toThrow()
  })
})

describe('license token', () => {
  it('round-trips a payload through sign and verify', () => {
    const payload = verifyLicenseToken(token(), trusted, device)
    expect(payload).toMatchObject({
      v: 1,
      kid: 'test-key',
      licenseId: 'lic-1',
      tier: 'standard',
      updatesUntil: '2027-11-01T00:00:00.000Z',
      expiresAt: null,
      deviceHash: device,
      issuedAt: '2026-11-01T00:00:00.000Z',
      checkBy: '2026-12-01T00:00:00.000Z',
    })
    expect(verifyToken(token(), trusted)).toEqual(payload)
  })

  it('refuses a tampered payload', () => {
    const [body, signature] = token().split('.') as [string, string]
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    const forged = Buffer.from(JSON.stringify({ ...payload, tier: 'lifetime', updatesUntil: null }), 'utf8').toString('base64url')
    expect(failure(() => verifyLicenseToken(`${forged}.${signature}`, trusted))).toBe('bad-signature')
  })

  it('refuses a tampered signature', () => {
    const [body, signature] = token().split('.') as [string, string]
    const flipped = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`
    expect(failure(() => verifyLicenseToken(`${body}.${flipped}`, trusted))).toBe('bad-signature')
  })

  it('refuses a key id the app does not trust', () => {
    expect(failure(() => verifyLicenseToken(token(), {}))).toBe('unknown-key')
    expect(failure(() => verifyLicenseToken(token(), { 'other-key': keys.publicKey }))).toBe('unknown-key')
  })

  it('refuses a token signed by another key under a trusted id', () => {
    const other = generateLicenseSigningKeypair('test-key')
    expect(failure(() => verifyLicenseToken(token(), { 'test-key': other.publicKey }))).toBe('bad-signature')
  })

  it('refuses a token issued to another device', () => {
    expect(failure(() => verifyLicenseToken(token(), trusted, hashDeviceId('device-two')))).toBe('wrong-device')
  })

  it('refuses anything that is not a token', () => {
    expect(failure(() => verifyLicenseToken('', trusted))).toBe('malformed')
    expect(failure(() => verifyLicenseToken('a.b.c', trusted))).toBe('malformed')
    expect(failure(() => verifyLicenseToken('bm90IGpzb24.AAAA', trusted))).toBe('malformed')
  })
})

describe('entitlement rule', () => {
  const standard = { tier: 'standard' as const, updatesUntil: '2027-11-01T00:00:00.000Z' }

  it('unlocks a build released on or before updatesUntil', () => {
    expect(isEntitled(standard, '2027-10-31T23:59:59.000Z')).toBe(true)
    expect(isEntitled(standard, '2027-11-01T00:00:00.000Z')).toBe(true)
    expect(isEntitled(standard, new Date('2026-01-01T00:00:00.000Z'))).toBe(true)
  })

  it('does not unlock a build released after updatesUntil', () => {
    expect(isEntitled(standard, '2027-11-01T00:00:00.001Z')).toBe(false)
    expect(isEntitled(standard, '2029-01-01T00:00:00.000Z')).toBe(false)
  })

  it('unlocks every build for a lifetime license', () => {
    expect(isEntitled({ tier: 'lifetime', updatesUntil: null }, '2099-01-01T00:00:00.000Z')).toBe(true)
  })

  it('unlocks nothing for a build date that is not a date', () => {
    expect(isEntitled(standard, 'yesterday')).toBe(false)
  })
})

describe('offline grace clock', () => {
  const build = '2026-10-01T00:00:00.000Z'
  const at = (days: number) => new Date(issuedAt.getTime() + days * DAY)

  it('asks for a re-check 7 days after the last successful check', () => {
    const payload = verifyLicenseToken(token(), trusted)
    expect(tokenStanding(payload, { buildDate: build, now: at(6) }).recheckDue).toBe(false)
    expect(tokenStanding(payload, { buildDate: build, now: at(7) }).recheckDue).toBe(true)
    expect(tokenStanding(payload, { buildDate: build, now: at(20), lastCheckedAt: at(15) }).recheckDue).toBe(false)
  })

  it('never expires a perpetual token for a build it covers', () => {
    const payload = verifyLicenseToken(token(), trusted)
    const standing = tokenStanding(payload, { buildDate: build, now: at(3650) })
    expect(standing).toMatchObject({ licensed: true, pro: true, perpetual: true, reason: 'ok' })
  })

  it('never expires a lifetime token', () => {
    const payload = verifyLicenseToken(token({ tier: 'lifetime', updatesUntil: null }), trusted)
    expect(tokenStanding(payload, { buildDate: '2040-01-01T00:00:00.000Z', now: at(9000) }).pro).toBe(true)
  })

  it('keeps a perpetual token licensed but locked for a build past updatesUntil', () => {
    const payload = verifyLicenseToken(token(), trusted)
    const standing = tokenStanding(payload, { buildDate: '2028-01-01T00:00:00.000Z', now: at(1) })
    expect(standing).toMatchObject({ licensed: true, pro: false, reason: 'not-entitled' })
  })

  it('works offline for 30 days after the last check on a license that can end', () => {
    const payload = verifyLicenseToken(token({ tier: 'team', updatesUntil: null, expiresAt: '2027-11-01T00:00:00.000Z' }), trusted)
    expect(tokenStanding(payload, { buildDate: build, now: at(30) })).toMatchObject({ licensed: true, pro: true, perpetual: false })
    expect(tokenStanding(payload, { buildDate: build, now: at(30.01) })).toMatchObject({ licensed: false, pro: false, reason: 'check-overdue' })
  })

  it('ends with its license however recent the check', () => {
    const payload = verifyLicenseToken(token({ tier: 'team', updatesUntil: null, expiresAt: at(10) }), trusted)
    expect(tokenStanding(payload, { buildDate: build, now: at(11), lastCheckedAt: at(10.5) })).toMatchObject({ licensed: false, reason: 'expired' })
  })
})

describe('license client', () => {
  function memory(): LicenseStorage & { values: Map<string, string> } {
    const values = new Map<string, string>()
    return {
      values,
      get: name => values.get(name) ?? null,
      set: (name, value) => { values.set(name, value) },
      delete: (name) => { values.delete(name) },
    }
  }

  function setup(respond: (path: string, body: any) => Response | Promise<Response>) {
    const storage = memory()
    const calls: Array<{ path: string, body: any }> = []
    let current = issuedAt
    const client = createLicenseClient({
      endpoint: 'https://example.test/licenses/',
      publicKeys: trusted,
      storage,
      buildDate: '2026-10-01T00:00:00.000Z',
      now: () => current,
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname
        const body = JSON.parse(String(init?.body))
        calls.push({ path, body })
        return respond(path, body)
      },
    })
    return { client, storage, calls, setNow: (date: Date) => { current = date } }
  }

  const granted = (overrides: Parameters<typeof token>[0] = {}) => Response.json({ ok: true, valid: true, token: token(overrides) })

  it('activates, stores the token and sends only the device hash', async () => {
    const { client, storage, calls } = setup(() => granted())
    const result = await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one', name: 'Studio', platform: 'darwin', appVersion: '1.0.0' })

    expect(result.ok).toBe(true)
    expect(calls[0]).toEqual({
      path: '/licenses/activate',
      body: { key: 'AAAA-BBBB-CCCC-DDDD-EEEE', deviceHash: device, deviceName: 'Studio', platform: 'darwin', appVersion: '1.0.0' },
    })
    expect(JSON.stringify(calls[0])).not.toContain('device-one')
    expect(storage.values.has('license')).toBe(true)
    expect(await client.standing()).toMatchObject({ licensed: true, pro: true, tier: 'standard', offline: false })
    expect(calls).toHaveLength(1)
  })

  it('reports the devices in use when the limit is reached, and stores nothing', async () => {
    const devices = [{ name: 'Studio', platform: 'darwin', lastSeenAt: '2026-10-30T00:00:00.000Z' }]
    const { client, storage } = setup(() => Response.json({ ok: false, reason: 'device-limit', message: 'In use on 2 devices.', devices }, { status: 409 }))
    const result = await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })

    expect(result).toEqual({ ok: false, reason: 'device-limit', message: 'In use on 2 devices.', devices })
    expect(storage.values.size).toBe(0)
  })

  it('refuses a token it cannot verify rather than storing it', async () => {
    const other = generateLicenseSigningKeypair('test-key')
    const forged = signLicenseToken({ licenseId: 'x', tier: 'lifetime', updatesUntil: null, deviceHash: device }, other)
    const { client, storage } = setup(() => Response.json({ ok: true, token: forged }))

    expect(await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })).toMatchObject({ ok: false, reason: 'invalid-token' })
    expect(storage.values.size).toBe(0)
  })

  it('re-checks after 7 days and keeps the fresh token', async () => {
    const { client, calls, setNow } = setup(() => granted({ issuedAt: new Date(issuedAt.getTime() + 8 * DAY) }))
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })

    setNow(new Date(issuedAt.getTime() + 3 * DAY))
    await client.standing()
    expect(calls).toHaveLength(1)

    setNow(new Date(issuedAt.getTime() + 8 * DAY))
    const standing = await client.standing()
    expect(calls.map(call => call.path)).toEqual(['/licenses/activate', '/licenses/check'])
    expect(standing).toMatchObject({ licensed: true, offline: false, lastCheckedAt: new Date(issuedAt.getTime() + 8 * DAY).toISOString() })

    await client.standing()
    expect(calls).toHaveLength(2)
  })

  it('answers from the stored token when the server cannot be reached', async () => {
    let down = false
    const { client, setNow } = setup(() => {
      if (down)
        throw new Error('offline')
      return granted()
    })
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })
    down = true

    setNow(new Date(issuedAt.getTime() + 400 * DAY))
    expect(await client.standing()).toMatchObject({ licensed: true, pro: true, offline: true })
  })

  it('locks a license that can end once 30 days pass with no check', async () => {
    let down = false
    const { client, setNow } = setup(() => {
      if (down)
        return new Response('bad gateway', { status: 502 })
      return granted({ tier: 'team', updatesUntil: null, expiresAt: '2027-11-01T00:00:00.000Z' })
    })
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })
    down = true

    setNow(new Date(issuedAt.getTime() + 29 * DAY))
    expect(await client.standing()).toMatchObject({ licensed: true, pro: true, offline: true })
    setNow(new Date(issuedAt.getTime() + 31 * DAY))
    expect(await client.standing()).toMatchObject({ licensed: false, pro: false, reason: 'check-overdue', offline: true })
  })

  it('forgets a license the server says was refunded', async () => {
    let refunded = false
    const { client, storage, setNow } = setup(() => refunded ? Response.json({ ok: true, valid: false, reason: 'refunded' }) : granted())
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })
    refunded = true

    setNow(new Date(issuedAt.getTime() + 8 * DAY))
    expect(await client.standing()).toMatchObject({ licensed: false, pro: false, reason: 'refunded' })
    expect(storage.values.size).toBe(0)
  })

  it('releases the device and forgets the license', async () => {
    const { client, storage, calls } = setup(path => path.endsWith('/deactivate') ? Response.json({ ok: true }) : granted())
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })

    expect(await client.release()).toEqual({ ok: true })
    expect(calls[1]).toEqual({ path: '/licenses/deactivate', body: { key: 'AAAA-BBBB-CCCC-DDDD-EEEE', deviceHash: device } })
    expect(storage.values.size).toBe(0)
    expect(await client.standing()).toMatchObject({ licensed: false, reason: 'unlicensed' })
  })

  it('keeps the license when a release cannot reach the server', async () => {
    let down = false
    const { client, storage } = setup(() => {
      if (down)
        throw new Error('offline')
      return granted()
    })
    await client.activate('AAAA-BBBB-CCCC-DDDD-EEEE', { id: 'device-one' })
    down = true

    expect((await client.release()).ok).toBe(false)
    expect(storage.values.size).toBe(1)
  })
})
