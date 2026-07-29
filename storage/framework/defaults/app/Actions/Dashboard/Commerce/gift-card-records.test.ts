import { describe, expect, test } from 'bun:test'
import { normalizeGiftCardRecord, summarizeGiftCards } from './gift-card-records'

describe('dashboard gift card records', () => {
  test('normalizes model columns, statuses, balances, and timestamps', () => {
    const record = normalizeGiftCardRecord({
      id: 42,
      code: 'STACKS-42',
      initial_balance: 100,
      current_balance: 125,
      currency: 'usd',
      status: 'active',
      recipient_email: 'gift@example.com',
      recipient_name: 'Ada',
      is_digital: 1,
      is_reloadable: 'true',
      is_active: true,
      expiry_date: '2027-01-02 03:04:05',
      last_used_date: 1_788_583_200,
    })

    expect(record).toMatchObject({
      id: '42',
      code: 'STACKS-42',
      initialBalance: 100,
      currentBalance: 100,
      currency: 'USD',
      status: 'ACTIVE',
      recipientEmail: 'gift@example.com',
      recipientName: 'Ada',
      isDigital: true,
      isReloadable: true,
      isActive: true,
      expiryDate: '2027-01-02T03:04:05.000Z',
      lastUsedDate: '2026-09-05T04:40:00.000Z',
    })
  })

  test('keeps currency totals separate and derives real availability', () => {
    const records = [
      normalizeGiftCardRecord({ id: 1, code: 'USD-1', initialBalance: 100, currentBalance: 25, currency: 'USD', status: 'ACTIVE', isActive: true, isDigital: true }),
      normalizeGiftCardRecord({ id: 2, code: 'USD-2', initialBalance: 50, currentBalance: 0, currency: 'USD', status: 'USED', isActive: true, isReloadable: true }),
      normalizeGiftCardRecord({ id: 3, code: 'EUR-1', initialBalance: 80, currentBalance: 40, currency: 'EUR', status: 'ACTIVE', isActive: false }),
    ]

    expect(summarizeGiftCards(records)).toEqual({
      total: 3,
      available: 1,
      enabled: 2,
      digital: 1,
      reloadable: 1,
      statuses: { ACTIVE: 2, USED: 1, EXPIRED: 0, DEACTIVATED: 0 },
      currencies: [
        { currency: 'EUR', cards: 1, initialBalance: 80, currentBalance: 40, redeemedBalance: 40 },
        { currency: 'USD', cards: 2, initialBalance: 150, currentBalance: 25, redeemedBalance: 125 },
      ],
    })
  })
})
