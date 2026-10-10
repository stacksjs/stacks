import { expect, test } from 'bun:test'
import { subscriptionGrantsAccess, subscriptionPeriod } from '../src/subscription-state'

test('only active and trial subscriptions grant access', () => {
  for (const status of ['incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused', 'canceled', undefined]) expect(subscriptionGrantsAccess(status)).toBe(false)
  expect(subscriptionGrantsAccess('active')).toBe(true)
  expect(subscriptionGrantsAccess('trialing')).toBe(true)
})
test('periods support both subscription and item schema versions', () => {
  const period = { current_period_start: 1704067200, current_period_end: 1706745600 }
  expect(subscriptionPeriod(period)).toEqual({ start: '2024-01-01T00:00:00.000Z', end: '2024-02-01T00:00:00.000Z' })
  expect(subscriptionPeriod({ items: { data: [period] } })).toEqual(subscriptionPeriod(period))
  expect(subscriptionPeriod({})).toEqual({ start: null, end: null })
})
