import { describe, expect, test } from 'bun:test'
import { normalizeCommerceCustomerRecord, summarizeCommerceCustomers } from './commerce-customer-records'

describe('dashboard commerce customer records', () => {
  test('normalizes persisted model columns without inventing contact data', () => {
    expect(normalizeCommerceCustomerRecord({
      id: 8,
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      phone: '+1 555 010 1234',
      total_spent: 129.5,
      last_order: '2026-07-20',
      status: 'Active',
      avatar: 'https://example.test/ada.jpg',
    })).toMatchObject({
      id: '8',
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      phone: '+1 555 010 1234',
      totalSpent: 129.5,
      lastOrder: '2026-07-20',
      status: 'Active',
      avatar: 'https://example.test/ada.jpg',
    })

    expect(normalizeCommerceCustomerRecord({ id: 9, status: 'legacy' })).toMatchObject({
      phone: '',
      totalSpent: 0,
      status: 'Unknown',
      avatar: '',
    })
  })

  test('summarizes persisted status and spend values', () => {
    const records = [
      normalizeCommerceCustomerRecord({ id: 1, totalSpent: 100, status: 'Active' }),
      normalizeCommerceCustomerRecord({ id: 2, totalSpent: 50, status: 'Inactive' }),
    ]

    expect(summarizeCommerceCustomers(records)).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
      totalSpent: 150,
      averageSpent: 75,
    })
  })
})
