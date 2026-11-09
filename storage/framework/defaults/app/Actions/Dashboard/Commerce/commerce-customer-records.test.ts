import { describe, expect, test } from 'bun:test'
import { normalizeCommerceCustomerRecord } from './commerce-customer-records'

describe('dashboard commerce customer records', () => {
  test('normalizes persisted model columns without inventing contact data', () => {
    expect(normalizeCommerceCustomerRecord({
      id: 8,
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      phone: '',
      total_spent: 129.5,
      last_order: '2026-07-20',
      status: 'Active',
      avatar: 'https://example.test/ada.jpg',
      created_at: '2026-07-29 12:00:00',
    })).toMatchObject({
      id: '8',
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      phone: '',
      totalSpent: 129.5,
      lastOrder: '2026-07-20T00:00:00.000Z',
      status: 'Active',
      avatar: 'https://example.test/ada.jpg',
      createdAt: '2026-07-29T12:00:00.000Z',
    })

    expect(() => normalizeCommerceCustomerRecord({
      id: 9,
      name: 'Legacy',
      email: 'legacy@example.test',
      phone: '+1 555 010 9876',
      totalSpent: 0,
      status: 'legacy',
      avatar: 'https://example.test/legacy.jpg',
      createdAt: '2026-07-29 12:00:00',
    })).toThrow('Customer 9.status must be Active or Inactive')
  })
})
