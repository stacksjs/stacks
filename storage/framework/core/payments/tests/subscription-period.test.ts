import type Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

/**
 * Where a subscription's period ends, and what is stored from it.
 *
 * Stripe moved `current_period_end` from the subscription onto its items in
 * API 2025-03-31.basil. Stacks kept reading the subscription, so every row
 * stored since had no `ends_at` - and what it did store before that was the
 * raw Unix seconds as text, in a timestamp column.
 */

// The Stripe client and the database, both captured with a spread and put
// back afterwards: a module mock is process-wide and outlives this file.
const updates: Array<{ id: string, params: unknown, options: unknown }> = []
const writes: Array<{ table: string, values: Record<string, unknown>, where: [string, unknown] }> = []
let subscriptionReturned: Partial<Stripe.Subscription> = {}

const realStripeModule = { ...await import('../src/drivers/stripe') }
mock.module('../src/drivers/stripe', () => ({
  ...realStripeModule,
  stripe: {
    subscriptions: {
      update: async (id: string, params: unknown, options: unknown) => {
        updates.push({ id, params, options })
        return subscriptionReturned
      },
    },
  },
}))

const realDatabase = { ...await import('@stacksjs/database/runtime') }
mock.module('@stacksjs/database/runtime', () => ({
  ...realDatabase,
  db: {
    updateTable: (table: string) => {
      const write = { table, values: {} as Record<string, unknown>, where: ['', undefined] as [string, unknown] }
      const chain = {
        set: (values: Record<string, unknown>) => {
          write.values = values
          return chain
        },
        where: (column: string, _op: string, value: unknown) => {
          write.where = [column, value]
          return chain
        },
        executeTakeFirst: async () => {
          writes.push(write)
        },
      }
      return chain
    },
  },
}))

afterAll(() => {
  mock.module('../src/drivers/stripe', () => realStripeModule)
  mock.module('@stacksjs/database/runtime', () => realDatabase)
})

const { manageSubscription, stripeTimestamp } = await import('../src/billable/subscription')
const { subscriptionPeriodEnd } = await import('../src/driver/stripe')

function subscription(fields: { itemEnd?: number, ownEnd?: number }): Stripe.Subscription {
  return {
    id: 'sub_1',
    items: { data: fields.itemEnd === undefined ? [] : [{ current_period_end: fields.itemEnd }] },
    ...(fields.ownEnd === undefined ? {} : { current_period_end: fields.ownEnd }),
  } as unknown as Stripe.Subscription
}

beforeEach(() => {
  updates.length = 0
  writes.length = 0
})

describe('subscriptionPeriodEnd', () => {
  it('reads the item, where Stripe keeps it now', () => {
    expect(subscriptionPeriodEnd(subscription({ itemEnd: 1790000000 }))).toBe(1790000000)
  })

  it('falls back to the subscription on an API version from before the move', () => {
    expect(subscriptionPeriodEnd(subscription({ ownEnd: 1780000000 }))).toBe(1780000000)
  })

  it('prefers the item when both are there', () => {
    expect(subscriptionPeriodEnd(subscription({ itemEnd: 1790000000, ownEnd: 1780000000 }))).toBe(1790000000)
  })

  it('answers undefined when neither is', () => {
    expect(subscriptionPeriodEnd(subscription({}))).toBeUndefined()
  })
})

describe('stripeTimestamp', () => {
  it('stores Unix seconds as a database timestamp, not as text', () => {
    expect(stripeTimestamp(1790000000)).toBe('2026-09-21 14:13:20')
  })

  it('stores nothing for a timestamp Stripe left out', () => {
    expect(stripeTimestamp(null)).toBeUndefined()
    expect(stripeTimestamp(undefined)).toBeUndefined()
  })
})

describe('manageSubscription.cancelAtPeriodEnd', () => {
  it('stops renewal with an idempotency key, and records when access ends', async () => {
    subscriptionReturned = subscription({ itemEnd: 1790000000 })

    await manageSubscription.cancelAtPeriodEnd('sub_1')

    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ id: 'sub_1', params: { cancel_at_period_end: true } })
    expect((updates[0]!.options as { idempotencyKey?: string }).idempotencyKey).toBeString()

    // The row keeps its status - it still entitles until then - and gains its end.
    expect(writes).toEqual([{ table: 'subscriptions', values: { ends_at: '2026-09-21 14:13:20' }, where: ['provider_id', 'sub_1'] }])
  })

  it('writes nothing locally when Stripe gives no period end', async () => {
    subscriptionReturned = subscription({})
    await manageSubscription.cancelAtPeriodEnd('sub_1')
    expect(updates).toHaveLength(1)
    expect(writes).toEqual([])
  })
})
