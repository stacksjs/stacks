import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'bun:test'
import { services } from '@stacksjs/config'

// stacksjs/stacks#2355 — `constructEvent` used to wrap the Stripe SDK's
// synchronous verification, which cannot run under Bun's resolution of the SDK:
// the `worker` export condition ships a crypto provider backed by WebCrypto's
// SubtleCrypto, which is async-only, so the sync call throws
// "SubtleCryptoProvider cannot be used in a synchronous context".
//
// It surfaced as a 401 on every genuine Stripe delivery, because verification
// runs inside the caller's try/catch. Stripe retried, every retry 401'd, and
// local subscription state silently stopped tracking reality.
//
// Two things hid it, and both are why these tests verify real signatures rather
// than assert shapes. Tests that call handlers directly never verify at all.
// And a vendored checkout resolves `stripe` to the `node` build, whose provider
// has a sync path, so even a verifying test can pass locally against a build
// the deployed app never loads. Asserting "the sync path throws" would pin the
// test runner's resolution, not the product; asserting that our export is async
// and verifies correctly holds either way.

const SECRET = 'whsec_test_2355'

function sign(body: string, secret = SECRET, at = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', secret).update(`${at}.${body}`).digest('hex')
  return `t=${at},v1=${mac}`
}

function eventBody(type = 'charge.succeeded'): string {
  return JSON.stringify({ id: 'evt_2355', object: 'event', type, data: { object: {} } })
}

let constructEvent: typeof import('../src/billable/webhook').constructEvent
let constructEventAsync: typeof import('../src/billable/webhook').constructEventAsync
let manageWebhook: typeof import('../src/billable/webhook').manageWebhook

beforeAll(async () => {
  // The Stripe client is a lazy proxy that demands a key on first property
  // access. Verification never calls the API, so any well-formed test key does.
  ;(services as any).stripe = { ...(services as any).stripe, secretKey: 'sk_test_2355' }
  const mod = await import('../src/billable/webhook')
  constructEvent = mod.constructEvent
  constructEventAsync = mod.constructEventAsync
  manageWebhook = mod.manageWebhook
})

describe('constructEvent', () => {
  it('is async, so it can never take the sync-only crypto path', () => {
    expect(constructEvent.constructor.name).toBe('AsyncFunction')
    expect(constructEventAsync.constructor.name).toBe('AsyncFunction')
  })

  it('is what the manageWebhook facade exposes', () => {
    expect(manageWebhook.constructEvent).toBe(constructEvent)
    expect(manageWebhook.constructEventAsync).toBe(constructEventAsync)
  })

  it('verifies a correctly signed payload', async () => {
    const body = eventBody()
    const event = await constructEvent(body, sign(body), SECRET)
    expect(event.id).toBe('evt_2355')
    expect(event.type).toBe('charge.succeeded')
  })

  it('rejects a payload that was altered after signing', async () => {
    const body = eventBody()
    const header = sign(body)
    await expect(constructEvent(body.replace('succeeded', 'failed'), header, SECRET)).rejects.toThrow()
  })

  it('rejects a signature made with a different secret', async () => {
    const body = eventBody()
    await expect(constructEvent(body, sign(body, 'whsec_wrong'), SECRET)).rejects.toThrow()
  })

  it('rejects rather than throwing synchronously, so an unawaited call cannot escape a try/catch', () => {
    let threwSynchronously = false
    try {
      void constructEvent('{}', 'bad', SECRET).catch(() => undefined)
    }
    catch {
      threwSynchronously = true
    }
    expect(threwSynchronously).toBe(false)
  })

  // The docblock notes a configured tolerance used to be dropped on the floor.
  it('honours a tolerance, rejecting a signature older than it allows', async () => {
    const body = eventBody()
    const old = Math.floor(Date.now() / 1000) - 600
    await expect(constructEvent(body, sign(body, SECRET, old), SECRET, 60)).rejects.toThrow()
    // Same stale signature passes when the tolerance is wide enough, proving
    // the rejection above is the tolerance and not the signature.
    const event = await constructEvent(body, sign(body, SECRET, old), SECRET, 3600)
    expect(event.id).toBe('evt_2355')
  })
})

describe('constructEventAsync', () => {
  it('still verifies, so callers on the old name keep working', async () => {
    const body = eventBody()
    const event = await constructEventAsync(body, sign(body), SECRET)
    expect(event.id).toBe('evt_2355')
  })
})
