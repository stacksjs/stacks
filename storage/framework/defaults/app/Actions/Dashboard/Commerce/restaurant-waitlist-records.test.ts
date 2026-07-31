import { describe, expect, it } from 'bun:test'
import {
  normalizeRestaurantWaitlistCustomerOption,
  normalizeRestaurantWaitlistRecord,
  restaurantWaitlistDateTimeLocal,
  restaurantWaitlistTimestamp,
  summarizeRestaurantWaitlist,
} from './restaurant-waitlist-records'

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 4,
    customer_id: null,
    name: 'Chris',
    email: 'chris@example.com',
    phone: null,
    party_size: 3,
    check_in_time: '2026-07-29 12:00:00',
    table_preference: 'booth',
    status: 'waiting',
    quoted_wait_time: 25,
    actual_wait_time: null,
    queue_position: null,
    created_at: '2026-07-29 12:00:00',
    ...overrides,
  }
}

describe('dashboard restaurant waitlist records', () => {
  it('round-trips persisted UTC timestamps through local date inputs', () => {
    const persisted = '2026-07-30 03:00:00'
    const input = restaurantWaitlistDateTimeLocal(persisted)

    expect(restaurantWaitlistTimestamp(persisted)).toBe(1785380400)
    expect(restaurantWaitlistTimestamp(input)).toBe(1785380400)
    expect(() => restaurantWaitlistTimestamp('not-a-date')).toThrow('valid timestamp')
  })

  it('normalizes model and database attribute names', () => {
    expect(normalizeRestaurantWaitlistRecord(
      entry({
        customer_id: 8,
        party_size: '3',
        quoted_wait_time: '25',
        queue_position: '2',
      }),
      new Set(['8']),
    )).toMatchObject({
      id: '4',
      customerId: '8',
      partySize: 3,
      checkInTime: '2026-07-29T12:00:00.000Z',
      tablePreference: 'booth',
      status: 'waiting',
      quotedWaitTime: 25,
      actualWaitTime: null,
      queuePosition: 2,
      createdAt: '2026-07-29T12:00:00.000Z',
    })
  })

  it('rejects corrupt fields and missing Customer relationships', () => {
    expect(() => normalizeRestaurantWaitlistRecord(entry({
      party_size: 0,
    }))).toThrow('WaitlistRestaurant 4.party_size must be at least 1')
    expect(() => normalizeRestaurantWaitlistRecord(entry({
      queue_position: 0,
    }))).toThrow('WaitlistRestaurant 4.queue_position must be at least 1')
    expect(() => normalizeRestaurantWaitlistRecord(
      entry({ customer_id: 99 }),
      new Set(),
    )).toThrow('WaitlistRestaurant 4.customer_id references missing Customer 99')
  })

  it('summarizes only persisted restaurant states and wait times', () => {
    const records = [
      normalizeRestaurantWaitlistRecord(entry({ id: 1, status: 'waiting', quoted_wait_time: 20 })),
      normalizeRestaurantWaitlistRecord(entry({ id: 2, status: 'waiting', quoted_wait_time: 30 })),
      normalizeRestaurantWaitlistRecord(entry({ id: 3, status: 'seated', quoted_wait_time: 10 })),
      normalizeRestaurantWaitlistRecord(entry({ id: 4, status: 'no_show', quoted_wait_time: 15 })),
    ]

    expect(summarizeRestaurantWaitlist(records)).toEqual({
      total: 4,
      waiting: 2,
      seated: 1,
      cancelled: 0,
      noShow: 1,
      averageQuotedWait: 25,
      seatingRate: 25,
    })
  })

  it('normalizes persisted Customer choices', () => {
    expect(normalizeRestaurantWaitlistCustomerOption({
      id: 9,
      name: 'Chris',
      email: 'chris@example.com',
      phone: '',
    })).toEqual({
      id: '9',
      label: 'Chris',
      detail: 'chris@example.com',
      email: 'chris@example.com',
      phone: '',
    })
  })
})
