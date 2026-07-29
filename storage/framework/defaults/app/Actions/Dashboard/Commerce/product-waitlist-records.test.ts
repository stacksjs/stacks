import { describe, expect, it } from 'bun:test'
import { normalizeProductWaitlistRecord, summarizeProductWaitlist } from './product-waitlist-records'

describe('dashboard product waitlist records', () => {
  it('normalizes database and model attribute names', () => {
    expect(normalizeProductWaitlistRecord({
      id: 4,
      name: 'Chris',
      email: 'chris@example.com',
      quantity: '3',
      notification_preference: 'email',
      product_id: 8,
      customer_id: 9,
      status: 'WAITING',
      created_at: '2026-07-28T12:00:00.000Z',
    })).toMatchObject({
      id: '4',
      quantity: 3,
      notificationPreference: 'email',
      productId: '8',
      customerId: '9',
      status: 'waiting',
    })
  })

  it('summarizes only native record states', () => {
    const records = [
      normalizeProductWaitlistRecord({ status: 'waiting' }),
      normalizeProductWaitlistRecord({ status: 'notified' }),
      normalizeProductWaitlistRecord({ status: 'purchased' }),
      normalizeProductWaitlistRecord({ status: 'purchased' }),
    ]
    expect(summarizeProductWaitlist(records)).toEqual({
      total: 4,
      waiting: 1,
      notified: 1,
      purchased: 2,
      conversionRate: 50,
    })
  })
})
