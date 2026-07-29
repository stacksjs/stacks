import { describe, expect, it } from 'bun:test'
import { normalizeRestaurantWaitlistCustomerOption, normalizeRestaurantWaitlistRecord, summarizeRestaurantWaitlist } from './restaurant-waitlist-records'

describe('dashboard restaurant waitlist records', () => {
  it('normalizes model and database attribute names', () => {
    expect(normalizeRestaurantWaitlistRecord({
      id: 4,
      customer_id: 8,
      name: 'Chris',
      email: 'chris@example.com',
      party_size: '3',
      check_in_time: '2026-07-29 12:00:00',
      table_preference: 'booth',
      status: 'WAITING',
      quoted_wait_time: '25',
      actual_wait_time: null,
      queue_position: '2',
      created_at: '2026-07-29 12:00:00',
    })).toMatchObject({
      id: '4',
      customerId: '8',
      partySize: 3,
      tablePreference: 'booth',
      status: 'waiting',
      quotedWaitTime: 25,
      actualWaitTime: null,
      queuePosition: 2,
    })
  })

  it('summarizes only persisted restaurant states and wait times', () => {
    const records = [
      normalizeRestaurantWaitlistRecord({ id: 1, status: 'waiting', quoted_wait_time: 20 }),
      normalizeRestaurantWaitlistRecord({ id: 2, status: 'waiting', quoted_wait_time: 30 }),
      normalizeRestaurantWaitlistRecord({ id: 3, status: 'seated', quoted_wait_time: 10 }),
      normalizeRestaurantWaitlistRecord({ id: 4, status: 'no_show', quoted_wait_time: 15 }),
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

  it('normalizes persisted customer choices', () => {
    expect(normalizeRestaurantWaitlistCustomerOption({
      id: 9,
      name: 'Chris',
      email: 'chris@example.com',
      phone: '555-0100',
    })).toEqual({
      id: '9',
      label: 'Chris',
      detail: 'chris@example.com',
      email: 'chris@example.com',
      phone: '555-0100',
    })
  })
})
