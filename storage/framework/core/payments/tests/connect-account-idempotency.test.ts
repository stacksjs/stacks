import type Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

/**
 * The idempotency key for creating a connected account. Keyed by user alone,
 * one user's second account (a gym and a coach storefront) inside Stripe's
 * 24-hour window reused the first key: Stripe refused it for differing
 * parameters, or handed back the first account.
 */

const creates: Array<{ params: Stripe.AccountCreateParams, options: { idempotencyKey: string } }> = []

// A module mock is process-wide and outlives this file, so put it back afterwards.
const realStripeModule = { ...await import('../src/drivers/stripe') }
mock.module('../src/drivers/stripe', () => ({
  ...realStripeModule,
  stripe: {
    accounts: {
      create: async (params: Stripe.AccountCreateParams, options: { idempotencyKey: string }) => {
        creates.push({ params, options })
        return { id: `acct_${creates.length}` }
      },
    },
  },
}))

afterAll(() => {
  mock.module('../src/drivers/stripe', () => realStripeModule)
})

const { connectedAccountIdempotencyKey, manageConnectedAccount } = await import('../src/connect/account')
const { idempotencyFingerprint } = await import('../src/idempotency')

const user = { id: 7, email: 'owner@example.com' } as never

function lastKey(): string {
  return creates.at(-1)!.options.idempotencyKey
}

beforeEach(() => {
  creates.length = 0
})

describe('createConnectedAccount idempotency key', () => {
  it('is the same for a retry of the same call, so the retry returns the original account', async () => {
    await manageConnectedAccount.createConnectedAccount(user, { country: 'DE' }, { reference: 'gym:12' })
    const first = lastKey()
    await manageConnectedAccount.createConnectedAccount(user, { country: 'DE' }, { reference: 'gym:12' })
    expect(lastKey()).toBe(first)
  })

  it('differs per reference, so one user can own a gym and a coach storefront', async () => {
    await manageConnectedAccount.createConnectedAccount(user, {}, { reference: 'gym:12' })
    const gym = lastKey()
    await manageConnectedAccount.createConnectedAccount(user, {}, { reference: 'coach:7' })
    expect(lastKey()).not.toBe(gym)
    expect(gym).toContain('gym:12')
  })

  it('differs when the creation parameters differ, even without a reference', async () => {
    await manageConnectedAccount.createConnectedAccount(user, { business_profile: { name: 'TriFit' } })
    const gym = lastKey()
    await manageConnectedAccount.createConnectedAccount(user, { business_profile: { name: 'Coach Pawel' } })
    expect(lastKey()).not.toBe(gym)
  })

  it('still dedupes a retry without a reference', async () => {
    await manageConnectedAccount.createConnectedAccount(user)
    const first = lastKey()
    await manageConnectedAccount.createConnectedAccount(user)
    expect(lastKey()).toBe(first)
  })

  it('differs per user', async () => {
    await manageConnectedAccount.createConnectedAccount(user, {}, { reference: 'storefront' })
    const seven = lastKey()
    await manageConnectedAccount.createConnectedAccount({ id: 8, email: 'owner@example.com' } as never, {}, { reference: 'storefront' })
    expect(lastKey()).not.toBe(seven)
  })

  it('test accounts have their own scope', async () => {
    await manageConnectedAccount.createTestConnectedAccount(user, {}, { reference: 'gym:12' })
    expect(lastKey()).toStartWith('stacks:connect.account.create_test:7:gym:12:')
    const test = lastKey()
    await manageConnectedAccount.createTestConnectedAccount(user, {}, { reference: 'coach:7' })
    expect(lastKey()).not.toBe(test)
  })

  it('does not depend on the order the parameters were written in', () => {
    const a = connectedAccountIdempotencyKey('connect.account.create', 7, { type: 'express', country: 'DE', metadata: { a: '1', b: '2' } })
    const b = connectedAccountIdempotencyKey('connect.account.create', 7, { metadata: { b: '2', a: '1' }, country: 'DE', type: 'express' })
    expect(a).toBe(b)
  })

  it('stays inside Stripe\'s 255-character limit', () => {
    const key = connectedAccountIdempotencyKey('connect.account.create', 7, { type: 'express' }, 'x'.repeat(400))
    expect(key.length).toBeLessThanOrEqual(255)
  })
})

describe('idempotencyFingerprint', () => {
  it('ignores key order and undefined properties', () => {
    expect(idempotencyFingerprint({ a: 1, b: [1, { c: 2, d: undefined }] })).toBe(idempotencyFingerprint({ b: [1, { c: 2 }], a: 1 }))
  })

  it('tells different values apart', () => {
    expect(idempotencyFingerprint({ a: 1 })).not.toBe(idempotencyFingerprint({ a: 2 }))
    expect(idempotencyFingerprint(['a', 'b'])).not.toBe(idempotencyFingerprint(['b', 'a']))
  })
})
