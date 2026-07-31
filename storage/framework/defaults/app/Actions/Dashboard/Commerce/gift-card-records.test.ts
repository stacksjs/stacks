import { describe, expect, test } from 'bun:test'
import { normalizeGiftCardRecord, summarizeGiftCards } from './gift-card-records'

function giftCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 42,
    code: 'STACKS-42',
    initial_balance: 100,
    current_balance: 25,
    currency: 'USD',
    status: 'ACTIVE',
    purchaser_id: null,
    recipient_email: null,
    recipient_name: null,
    personal_message: null,
    is_digital: false,
    is_reloadable: false,
    is_active: true,
    expiry_date: null,
    last_used_date: null,
    template_id: null,
    customer_id: null,
    created_at: '2026-07-29 12:00:00',
    ...overrides,
  }
}

describe('dashboard gift card records', () => {
  test('normalizes model columns, balances, and timestamps without clamping reloads', () => {
    const record = normalizeGiftCardRecord(giftCard({
      current_balance: 125,
      currency: 'usd',
      recipient_email: 'gift@example.com',
      recipient_name: 'Ada',
      is_digital: 1,
      is_reloadable: 'true',
      expiry_date: '2027-01-02 03:04:05',
      last_used_date: 1_788_583_200,
    }))

    expect(record).toMatchObject({
      id: '42',
      code: 'STACKS-42',
      initialBalance: 100,
      currentBalance: 125,
      currency: 'USD',
      status: 'ACTIVE',
      recipientEmail: 'gift@example.com',
      recipientName: 'Ada',
      isDigital: true,
      isReloadable: true,
      isActive: true,
      expiryDate: '2027-01-02T03:04:05.000Z',
      lastUsedDate: '2026-09-05T04:40:00.000Z',
      createdAt: '2026-07-29T12:00:00.000Z',
    })
  })

  test('rejects corrupt values and missing customer relationships', () => {
    expect(() => normalizeGiftCardRecord(giftCard({
      current_balance: -1,
    }))).toThrow('GiftCard 42.current_balance must be at least 0')

    expect(() => normalizeGiftCardRecord(giftCard({
      status: 'legacy',
    }))).toThrow('GiftCard 42.status must be ACTIVE')

    expect(() => normalizeGiftCardRecord(
      giftCard({ customer_id: 7 }),
      new Set(),
    )).toThrow('GiftCard 42.customer_id references missing Customer 7')
  })

  test('keeps currency totals separate and derives real availability', () => {
    const records = [
      normalizeGiftCardRecord(giftCard({
        id: 1,
        code: 'USD-1',
        initial_balance: 100,
        current_balance: 25,
        currency: 'USD',
        status: 'ACTIVE',
        is_active: true,
        is_digital: true,
      })),
      normalizeGiftCardRecord(giftCard({
        id: 2,
        code: 'USD-2',
        initial_balance: 50,
        current_balance: 0,
        currency: 'USD',
        status: 'USED',
        is_active: true,
        is_reloadable: true,
      })),
      normalizeGiftCardRecord(giftCard({
        id: 3,
        code: 'EUR-1',
        initial_balance: 80,
        current_balance: 40,
        currency: 'EUR',
        status: 'ACTIVE',
        is_active: false,
      })),
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
