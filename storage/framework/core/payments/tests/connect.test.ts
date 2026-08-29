import type Stripe from 'stripe'
import { describe, expect, test } from 'bun:test'
import { handleWebhookEvent } from '../src/billable/webhook'
import { requireAccountId } from '../src/connect/account'
import { manageDestinationCharge } from '../src/connect/charge'
import { getAccount, getConnectedAccountId, getPayout, onAccount, onPayout } from '../src/connect/webhook'

const { applicationFeeFor } = manageDestinationCharge

function event(type: string, object: unknown, account?: string): Stripe.Event {
  return { type, data: { object }, ...(account ? { account } : {}) } as unknown as Stripe.Event
}

describe('@stacksjs/payments - Connect', () => {
  describe('applicationFeeFor', () => {
    test('takes the configured percentage of the charge', () => {
      expect(applicationFeeFor(10_000, { platformFeePercent: 15 })).toBe(1500)
    })

    test('rounds the fee down so it can never exceed the charge', () => {
      // 33% of 101 is 33.33. Rounding up would bill 34 against a charge that
      // only justifies 33, and on small amounts an up-rounded fee can pass the
      // charge itself, which Stripe rejects outright.
      expect(applicationFeeFor(101, { platformFeePercent: 33 })).toBe(33)
    })

    test('an explicit amount wins over a percentage', () => {
      expect(applicationFeeFor(10_000, { applicationFeeAmount: 250, platformFeePercent: 15 })).toBe(250)
    })

    test('a zero percentage takes nothing, rather than falling back to config', () => {
      expect(applicationFeeFor(10_000, { platformFeePercent: 0 })).toBe(0)
    })

    test('rejects a fee larger than the charge', () => {
      expect(() => applicationFeeFor(1000, { applicationFeeAmount: 1001 })).toThrow(/exceeds the charge amount/)
    })

    test('rejects a nonsensical percentage', () => {
      expect(() => applicationFeeFor(1000, { platformFeePercent: 120 })).toThrow(/between 0 and 100/)
      expect(() => applicationFeeFor(1000, { platformFeePercent: -1 })).toThrow(/between 0 and 100/)
    })

    test('rejects a negative explicit fee', () => {
      expect(() => applicationFeeFor(1000, { applicationFeeAmount: -1 })).toThrow(/non-negative/)
    })
  })

  describe('requireAccountId', () => {
    test('accepts a connected account id', () => {
      expect(() => requireAccountId('acct_123', 'destinationCharge')).not.toThrow()
    })

    test('rejects an id from a different Stripe object', () => {
      // Passing a customer id here is the easy mistake, and Stripe answers it
      // with a 404 that reads as "this account does not exist".
      expect(() => requireAccountId('cus_123', 'destinationCharge')).toThrow(/acct_/)
    })

    test('rejects an empty id and names the caller', () => {
      expect(() => requireAccountId('', 'listPayouts')).toThrow(/listPayouts/)
    })
  })

  describe('event extractors', () => {
    test('reads the connected account off the event, not the payload', () => {
      expect(getConnectedAccountId(event('account.updated', {}, 'acct_42'))).toBe('acct_42')
    })

    test('returns null for a platform-account event', () => {
      expect(getConnectedAccountId(event('payment_intent.succeeded', {}))).toBeNull()
    })

    test('getAccount reads account.updated but not the deauthorization event', () => {
      expect(getAccount(event('account.updated', { id: 'acct_1' }))).toEqual({ id: 'acct_1' } as never)
      // `account.application.deauthorized` carries an Application, not an
      // Account, so returning it as one would hand callers the wrong object.
      expect(getAccount(event('account.application.deauthorized', { id: 'ca_1' }))).toBeNull()
    })

    test('getPayout reads payout events only', () => {
      expect(getPayout(event('payout.paid', { id: 'po_1' }))).toEqual({ id: 'po_1' } as never)
      expect(getPayout(event('account.updated', { id: 'acct_1' }))).toBeNull()
    })
  })

  describe('webhook registration', () => {
    test('onAccount routes account.updated to its handler', async () => {
      let seen: string | null = null
      onAccount({ updated: (e) => { seen = getConnectedAccountId(e) } })

      const result = await handleWebhookEvent(event('account.updated', { id: 'acct_7' }, 'acct_7'))

      expect(result.handled).toBe(true)
      expect(seen).toBe('acct_7')
    })

    test('onPayout routes payout.failed to its handler', async () => {
      let failed = false
      onPayout({ failed: () => { failed = true } })

      await handleWebhookEvent(event('payout.failed', { id: 'po_9' }, 'acct_9'))

      expect(failed).toBe(true)
    })

    test('an unregistered Connect event is reported unhandled', async () => {
      const result = await handleWebhookEvent(event('account.external_account.created', {}, 'acct_1'))
      expect(result.handled).toBe(false)
    })
  })
})
