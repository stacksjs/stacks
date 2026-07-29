import { describe, expect, test } from 'bun:test'
import { buildEventAnalytics } from './event-analytics'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('event analytics', () => {
  test('groups event occurrences without mixing currencies', () => {
    const result = buildEventAnalytics([
      {
        id: '1',
        name: 'purchase_completed',
        category: 'conversion',
        path: '/checkout',
        value: 50,
        currency: 'USD',
        createdAt: '2026-07-29T10:00:00.000Z',
      },
      {
        id: '2',
        name: 'purchase_completed',
        category: 'conversion',
        path: '/checkout',
        value: 40,
        currency: 'EUR',
        createdAt: '2026-07-29T11:00:00.000Z',
      },
    ], 'day', now)

    expect(result.overview).toEqual({
      occurrences: 2,
      eventNames: 1,
      categories: 1,
      valuedEvents: 2,
    })
    expect(result.valueByCurrency).toEqual([
      { currency: 'USD', value: 50, events: 1 },
      { currency: 'EUR', value: 40, events: 1 },
    ])
  })

  test('excludes occurrences outside the selected range', () => {
    const result = buildEventAnalytics([
      {
        id: '1',
        name: 'old_event',
        category: 'custom',
        path: '/',
        value: 0,
        currency: 'USD',
        createdAt: '2026-07-20T10:00:00.000Z',
      },
    ], 'day', now)

    expect(result.events).toEqual([])
  })
})
