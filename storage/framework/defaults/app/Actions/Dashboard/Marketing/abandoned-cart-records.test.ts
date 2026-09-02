import { describe, expect, test } from 'bun:test'
import {
  abandonedCartSegment,
  isRecoverySegment,
  normalizeAbandonedCarts,
  reachOf,
  recoveryCampaignWriteData,
  validateRecoveryCampaign,
} from './abandoned-cart-records'

const NOW = new Date('2026-09-01T18:00:00.000Z')

/** A cart, as the driver hands it over. */
function cart(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    status: 'abandoned',
    total: 84,
    total_items: 3,
    currency: 'usd',
    customer_id: 11,
    updated_at: '2026-09-01 06:00:00',
    ...overrides,
  }
}

const CUSTOMERS = [
  { id: 11, name: 'Rosa Klein', email: 'Rosa@example.com' },
  { id: 12, name: 'Amir Haddad', email: 'amir@example.com' },
]

const RECOVERY_CAMPAIGN = {
  id: 5,
  name: 'Left something behind',
  status: 'sent',
  sent_count: 40,
  segment_definition: JSON.stringify(abandonedCartSegment(6, 25)),
}

describe('abandoned cart records', () => {
  test('reads what was left behind, and how long ago', () => {
    const result = normalizeAbandonedCarts(
      [cart()],
      [
        { cart_id: 1, quantity: 2, product_name: 'Pour-over kettle' },
        { cart_id: 1, quantity: 1, product_name: 'Burr grinder' },
      ],
      CUSTOMERS,
      [],
      [],
      { now: NOW },
    )

    expect(result.records[0]).toMatchObject({
      customerName: 'Rosa Klein',
      itemCount: 3,
      items: ['Pour-over kettle', 'Burr grinder'],
      value: 84,
      currency: 'USD',
      idleHours: 12,
      state: 'abandoned',
      contacted: false,
    })
  })

  test('a bare database timestamp is read as UTC, not as local time', () => {
    const result = normalizeAbandonedCarts(
      // Two hours before NOW, written the way SQLite writes CURRENT_TIMESTAMP.
      [cart({ updated_at: '2026-09-01 16:00:00' })],
      [],
      CUSTOMERS,
      [],
      [],
      { now: NOW },
    )

    // Read as local in a UTC-7 browser this is five hours in the future,
    // which clamps to "idle 0h" and empties every age filter on the page.
    expect(result.records[0].idleHours).toBe(2)
  })

  test('a timestamp that carries its own zone is left alone', () => {
    const result = normalizeAbandonedCarts(
      [cart({ updated_at: '2026-09-01T16:00:00+02:00' })],
      [],
      CUSTOMERS,
      [],
      [],
      { now: NOW },
    )

    expect(result.records[0].idleHours).toBe(4)
  })

  test('a cart with no line items still counts what it says it holds', () => {
    const result = normalizeAbandonedCarts([cart({ total_items: 5 })], [], CUSTOMERS, [], [], { now: NOW })

    expect(result.records[0].itemCount).toBe(5)
  })

  test('a cart without a customer is a guest, not a blank row', () => {
    const result = normalizeAbandonedCarts([cart({ customer_id: null })], [], CUSTOMERS, [], [], { now: NOW })

    expect(result.records[0]).toMatchObject({ customerName: 'Guest', customerEmail: '' })
  })

  test('only campaigns aimed at carts count as recovery campaigns', () => {
    const result = normalizeAbandonedCarts(
      [],
      [],
      [],
      [
        RECOVERY_CAMPAIGN,
        { id: 6, name: 'Weekly newsletter', status: 'sent', segment_definition: JSON.stringify({ operator: 'and', rules: [] }) },
        { id: 7, name: 'No segment at all', status: 'draft', segment_definition: null },
        { id: 8, name: 'Half-written segment', status: 'draft', segment_definition: '{ not json' },
      ],
      [],
      { now: NOW },
    )

    expect(result.campaigns.map(campaign => campaign.id)).toEqual(['5'])
    // The rules the campaign was written with survive on it, so a sent
    // campaign still says what it was aimed at once those carts are gone.
    expect(result.campaigns[0]).toMatchObject({ idleHours: 6, minimumValue: 25, sentCount: 40 })
  })

  test('a customer a recovery campaign wrote to is marked as contacted', () => {
    const result = normalizeAbandonedCarts(
      [cart()],
      [],
      CUSTOMERS,
      [RECOVERY_CAMPAIGN],
      // The address is matched case-insensitively: a send records whatever
      // the customer typed, and `Rosa@` and `rosa@` are one person.
      [{ campaign_id: 5, recipient: 'rosa@example.com', sent_at: '2026-09-01 07:00:00' }],
      { now: NOW },
    )

    expect(result.records[0].contacted).toBe(true)
    expect(result.summary.contacted).toBe(1)
  })

  test('a send from an ordinary campaign does not count as contact', () => {
    const result = normalizeAbandonedCarts(
      [cart()],
      [],
      CUSTOMERS,
      [{ id: 6, name: 'Weekly newsletter', status: 'sent', segment_definition: '{}' }],
      [{ campaign_id: 6, recipient: 'rosa@example.com', sent_at: '2026-09-01 07:00:00' }],
      { now: NOW },
    )

    // Otherwise every newsletter subscriber with a cold cart would read as
    // somebody the recovery campaign had already reached.
    expect(result.records[0].contacted).toBe(false)
  })

  test('a checkout after the email is credited to the campaign', () => {
    const result = normalizeAbandonedCarts(
      [cart({ status: 'converted', updated_at: '2026-09-01 09:00:00' })],
      [],
      CUSTOMERS,
      [RECOVERY_CAMPAIGN],
      [{ campaign_id: 5, recipient: 'rosa@example.com', sent_at: '2026-09-01 07:00:00' }],
      { now: NOW },
    )

    expect(result.records[0].state).toBe('recovered')
    expect(result.summary).toMatchObject({ recovered: 1, recoveredValue: 84, open: 0, recoveryRate: 100 })
  })

  test('a checkout before any email is a sale, not a recovery', () => {
    const result = normalizeAbandonedCarts(
      [cart({ status: 'converted', updated_at: '2026-09-01 06:00:00' })],
      [],
      CUSTOMERS,
      [RECOVERY_CAMPAIGN],
      [{ campaign_id: 5, recipient: 'rosa@example.com', sent_at: '2026-09-01 07:00:00' }],
      { now: NOW },
    )

    // Somebody who came back on their own is not the campaign's doing, and
    // crediting them would make every recovery campaign look like it worked.
    expect(result.records[0].state).toBe('abandoned')
    expect(result.summary.recovered).toBe(0)
  })

  test('the rate counts only carts that were actually chased', () => {
    const result = normalizeAbandonedCarts(
      [
        cart({ id: 1, status: 'converted', updated_at: '2026-09-01 09:00:00' }),
        cart({ id: 2, customer_id: 12, total: 40 }),
        // Never written to, so it is not evidence either way.
        cart({ id: 3, customer_id: null, total: 10 }),
      ],
      [],
      CUSTOMERS,
      [RECOVERY_CAMPAIGN],
      [
        { campaign_id: 5, recipient: 'rosa@example.com', sent_at: '2026-09-01 07:00:00' },
        { campaign_id: 5, recipient: 'amir@example.com', sent_at: '2026-09-01 07:00:00' },
      ],
      { now: NOW },
    )

    // One recovered, one contacted and still cold: 50%, not 33%.
    expect(result.summary).toMatchObject({ open: 2, recovered: 1, contacted: 1, recoveryRate: 50 })
    expect(result.summary.openValue).toBe(50)
    expect(result.summary.averageValue).toBe(25)
  })

  test('an expired cart is kept, and says so', () => {
    const result = normalizeAbandonedCarts([cart({ status: 'expired' })], [], CUSTOMERS, [], [], { now: NOW })

    expect(result.records[0].state).toBe('expired')
    expect(result.summary.open).toBe(1)
  })

  test('nothing to chase divides by nothing', () => {
    const result = normalizeAbandonedCarts([], [], [], [], [], { now: NOW })

    expect(result.summary).toMatchObject({ open: 0, recovered: 0, recoveryRate: 0, averageValue: 0 })
  })
})

describe('who a recovery campaign would reach', () => {
  const records = normalizeAbandonedCarts(
    [
      cart({ id: 1, total: 84, updated_at: '2026-09-01 06:00:00' }),
      cart({ id: 2, customer_id: 12, total: 12, updated_at: '2026-09-01 06:00:00' }),
      cart({ id: 3, customer_id: 12, total: 90, updated_at: '2026-09-01 17:30:00' }),
      cart({ id: 4, customer_id: null, total: 200, updated_at: '2026-09-01 06:00:00' }),
    ],
    [],
    CUSTOMERS,
    [],
    [],
    { now: NOW },
  ).records

  test('counts only carts old enough and worth enough', () => {
    // Cart 2 is too cheap, cart 3 too fresh, cart 4 has nobody to write to.
    expect(reachOf(records, 6, 25)).toEqual({ carts: 1, value: 84 })
  })

  test('widening the rules widens the audience', () => {
    expect(reachOf(records, 1, 0)).toEqual({ carts: 2, value: 96 })
  })
})

describe('composing a recovery campaign', () => {
  test('stores the rules it was written with', () => {
    const data = recoveryCampaignWriteData({
      name: 'Left something behind',
      subject: 'Your cart is still here',
      idleHours: 6,
      minimumValue: 25,
    })

    expect(isRecoverySegment(data.segment_definition)).toBe(true)
    expect(JSON.parse(data.segment_definition).rules).toContainEqual({
      field: 'cart.idleHours',
      operator: 'gte',
      value: 6,
    })
    expect(data).toMatchObject({ type: 'email', status: 'draft', template: 'abandoned-cart' })
  })

  test('a send time makes it scheduled', () => {
    const data = recoveryCampaignWriteData({
      name: 'Left something behind',
      subject: 'Your cart is still here',
      scheduledAt: '2026-09-02 09:00:00',
    })

    expect(data.status).toBe('scheduled')
    expect(validateRecoveryCampaign(data, NOW)).toBe('')
  })

  test('refuses a send time that has already passed', () => {
    const data = recoveryCampaignWriteData({
      name: 'Left something behind',
      subject: 'Your cart is still here',
      scheduledAt: '2026-08-30 09:00:00',
    })

    expect(validateRecoveryCampaign(data, NOW)).toContain('future')
  })

  test('refuses a campaign with nothing to say', () => {
    const data = recoveryCampaignWriteData({ name: 'Left something behind', subject: '' })

    expect(validateRecoveryCampaign(data, NOW)).toContain('subject')
  })

  test('refuses to take its audience from an email list', () => {
    const data = recoveryCampaignWriteData({
      name: 'Left something behind',
      subject: 'Your cart is still here',
      emailListId: 7,
    })

    // A recovery campaign aimed at a list is a newsletter with a misleading
    // name: it would write to the list, not to the people who left carts.
    expect(validateRecoveryCampaign(data, NOW)).toContain('abandoned carts')
  })

  test('falls back to a sane idle window rather than zero', () => {
    const data = recoveryCampaignWriteData({ name: 'Recovery', subject: 'Still here', idleHours: 0 })

    // An idle window of zero would write to somebody the moment they put
    // something in a cart, while they are still shopping.
    expect(JSON.parse(data.segment_definition).rules[1].value).toBe(4)
  })
})
