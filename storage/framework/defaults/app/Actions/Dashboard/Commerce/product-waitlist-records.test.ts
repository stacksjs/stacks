import { describe, expect, it } from 'bun:test'
import {
  normalizeProductWaitlistCustomerOption,
  normalizeProductWaitlistOption,
  normalizeProductWaitlistRecord,
  summarizeProductWaitlist,
} from './product-waitlist-records'

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 4,
    name: 'Chris',
    email: 'chris@example.com',
    phone: null,
    quantity: 3,
    notification_preference: 'email',
    source: 'website',
    notes: null,
    status: 'waiting',
    product_id: 8,
    customer_id: null,
    created_at: '2026-07-28T12:00:00.000Z',
    ...overrides,
  }
}

describe('dashboard product waitlist records', () => {
  it('normalizes database and model attribute names', () => {
    expect(normalizeProductWaitlistRecord(
      entry({ quantity: '3', customer_id: 9 }),
      new Set(['8']),
      new Set(['9']),
    )).toMatchObject({
      id: '4',
      quantity: 3,
      notificationPreference: 'email',
      productId: '8',
      customerId: '9',
      status: 'waiting',
      createdAt: '2026-07-28T12:00:00.000Z',
    })
  })

  it('rejects corrupt fields and missing relationships', () => {
    expect(() => normalizeProductWaitlistRecord(
      entry({ quantity: 0 }),
      new Set(['8']),
    )).toThrow('WaitlistProduct 4.quantity must be at least 1')
    expect(() => normalizeProductWaitlistRecord(
      entry({ product_id: 99 }),
      new Set(),
    )).toThrow('WaitlistProduct 4.product_id references missing Product 99')
    expect(() => normalizeProductWaitlistRecord(
      entry({ customer_id: 99 }),
      new Set(['8']),
      new Set(),
    )).toThrow('WaitlistProduct 4.customer_id references missing Customer 99')
  })

  it('summarizes only native record states', () => {
    const productIds = new Set(['8'])
    const records = [
      normalizeProductWaitlistRecord(entry({ id: 1, status: 'waiting' }), productIds),
      normalizeProductWaitlistRecord(entry({ id: 2, status: 'notified' }), productIds),
      normalizeProductWaitlistRecord(entry({ id: 3, status: 'purchased' }), productIds),
      normalizeProductWaitlistRecord(entry({ id: 4, status: 'purchased' }), productIds),
    ]
    expect(summarizeProductWaitlist(records)).toEqual({
      total: 4,
      waiting: 1,
      notified: 1,
      purchased: 2,
      conversionRate: 50,
    })
  })

  it('normalizes persisted Product and Customer choices', () => {
    expect(normalizeProductWaitlistOption({
      id: 8,
      name: 'Native Mug',
      inventory_count: '12',
    })).toEqual({
      id: '8',
      label: 'Native Mug',
      detail: '12 in inventory',
    })

    expect(normalizeProductWaitlistCustomerOption({
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
