import type { ShopifyCustomerPayload, ShopifyOrderPayload, ShopwareCustomerPayload, ShopwareOrderPayload, WooCustomerPayload, WooOrderPayload } from '../imports'
import { describe, expect, it } from 'bun:test'
import {
  amountOrZero,
  gmtTimestamp,
  mapShopifyCustomer,
  mapShopifyOrder,
  mapShopwareCustomer,
  mapShopwareOrder,
  mapWooCustomer,
  mapWooOrder,
  normalizeEmail,
  PriceFormatError,
  shopifyOrderStatus,
  shopwareOrderStatus,
  signedMinor,
  unitFromTotal,
  wooOrderStatus,
} from '../imports'
import shopifyCustomers from './fixtures/account-import/shopify-customers.json'
import shopifyOrders from './fixtures/account-import/shopify-orders.json'
import shopwareCustomers from './fixtures/account-import/shopware-customers.json'
import shopwareOrders from './fixtures/account-import/shopware-orders.json'
import wooCustomers from './fixtures/account-import/woocommerce-customers.json'
import wooOrders from './fixtures/account-import/woocommerce-orders.json'

/**
 * Mapping admin API payloads to normalized customers and orders, from
 * fixtures recorded in each platform's documented response shape (Shopify
 * Admin REST 2026-10, WooCommerce REST v3, Shopware 6 Admin API search with
 * `Accept: application/json`). Pure functions, no I/O.
 */

const shopifyCustomer = (index: number) => structuredClone(shopifyCustomers.customers[index]) as unknown as ShopifyCustomerPayload
const shopifyOrder = (index: number) => structuredClone(shopifyOrders.orders[index]) as unknown as ShopifyOrderPayload
const wooCustomer = (index: number) => structuredClone(wooCustomers[index]) as unknown as WooCustomerPayload
const wooOrder = (index: number) => structuredClone(wooOrders[index]) as unknown as WooOrderPayload
const swCustomer = (index: number) => structuredClone(shopwareCustomers.data[index]) as unknown as ShopwareCustomerPayload
const swOrder = (index: number) => structuredClone(shopwareOrders.data[index]) as unknown as ShopwareOrderPayload

/** Keys anywhere in a value, to prove nothing password- or card-shaped is carried. */
function keysOf(value: unknown): string[] {
  if (!value || typeof value !== 'object')
    return []
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)])
}

describe('shared mapping helpers', () => {
  it('normalizes emails into the deduplication key', () => {
    expect(normalizeEmail('  Bob.Norman@Mail.Example.COM ')).toBe('bob.norman@mail.example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })

  it('reads WooCommerce GMT timestamps as UTC, not local time', () => {
    expect(gmtTimestamp('2026-09-14T09:12:44')).toBe('2026-09-14T09:12:44.000Z')
    expect(gmtTimestamp('2026-09-14T09:12:44+00:00')).toBe('2026-09-14T09:12:44.000Z')
    expect(gmtTimestamp('')).toBeNull()
  })

  it('converts signed amounts without float arithmetic', () => {
    expect(signedMinor('19.99', 2)).toBe(1999)
    expect(signedMinor('-1.00', 2)).toBe(-100)
    expect(signedMinor(-10, 2)).toBe(-1000)
    // 0.1 + 0.2 would be 0.30000000000000004; the decimal string never is.
    expect(signedMinor(0.3, 2)).toBe(30)
    expect(signedMinor(119.39, 2)).toBe(11939)
    expect(signedMinor('1000', 0)).toBe(1000)
    expect(signedMinor('1.234', 3)).toBe(1234)
    expect(signedMinor('1.005', 2)).toBe(101)
    expect(signedMinor(null, 2)).toBeNull()
    expect(signedMinor('', 2)).toBeNull()
    expect(() => signedMinor('1,000.00', 2)).toThrow(PriceFormatError)
    expect(() => signedMinor(Number.NaN, 2)).toThrow(PriceFormatError)
  })

  it('records a malformed or negative amount as zero, with a warning', () => {
    const warnings: Array<{ message: string }> = []
    expect(amountOrZero('12.50', 2, 'total', '1', warnings)).toBe(1250)
    expect(amountOrZero('-3.00', 2, 'total', '1', warnings)).toBe(0)
    expect(amountOrZero('abc', 2, 'tax', '1', warnings)).toBe(0)
    expect(amountOrZero(undefined, 2, 'tip', '1', warnings)).toBe(0)
    expect(warnings.map(warning => warning.message)).toEqual([
      'total is negative (-3.00); recorded as 0',
      'tax: Unreadable price "abc": expected a plain decimal such as 19.99; recorded as 0',
    ])
  })

  it('spreads a line total over its quantity with integer half-up rounding', () => {
    expect(unitFromTotal(6000, 3)).toBe(2000)
    expect(unitFromTotal(1000, 3)).toBe(333)
    expect(unitFromTotal(1001, 2)).toBe(501)
    expect(unitFromTotal(999, 1)).toBe(999)
  })
})

describe('Shopify Admin API mapping', () => {
  it('maps a customer, deduplication key and spend in minor units', () => {
    const { record, warnings } = mapShopifyCustomer(shopifyCustomer(0))
    expect(warnings).toEqual([])
    expect(record).toEqual({
      source: 'shopify',
      externalId: '207119551',
      email: 'bob.norman@mail.example.com',
      name: 'Bob Norman',
      phone: '+16136120707',
      active: null,
      totalSpentMinor: 19965,
      currency: 'USD',
      lastOrderAt: null,
      avatarUrl: null,
      createdAt: '2025-03-04T16:20:00.000Z',
    })
  })

  it('skips a customer without an email, and names one from the default address', () => {
    expect(mapShopifyCustomer(shopifyCustomer(1))).toEqual({
      record: null,
      warnings: [{ externalId: '207119552', message: 'skipped: the customer has no valid email address, which Stacks customers are keyed by' }],
    })
    const jane = mapShopifyCustomer(shopifyCustomer(2)).record!
    expect(jane.name).toBe('Jane Roe')
    expect(jane.phone).toBe('+14155550199')
  })

  it('maps an order: shop-currency totals, lines, customer and address', () => {
    const { record, warnings } = mapShopifyOrder(shopifyOrder(0))
    expect(warnings).toEqual([])
    expect(record).toMatchObject({
      source: 'shopify',
      externalId: '450789469',
      number: '#1001',
      currency: 'USD',
      status: 'SHIPPED',
      sourceStatus: 'paid, fulfilled',
      totalMinor: 5449,
      taxMinor: 389,
      discountMinor: 500,
      // shop_money, never the presentment (CAD) amount.
      shippingMinor: 750,
      tipMinor: 0,
      customer: { externalId: '207119551', email: 'bob.norman@mail.example.com', name: 'Bob Norman', phone: '+16136120707' },
      shippingAddress: 'Bob Norman, Chestnut Street 92, Apt 4, Louisville, KY 40202, US',
      note: 'Please leave at the side door.',
      placedAt: '2026-09-10T15:00:00.000Z',
    })
    expect(record!.lines).toEqual([
      { externalId: '669751112', productExternalId: '7612345678901', variantExternalId: '42811111111101', name: 'Organic Cotton Tee - S / Black', sku: 'TEE-S-BLK', quantity: 2, unitPriceMinor: 2400 },
      { externalId: '669751113', productExternalId: '7612345678902', variantExternalId: '42811111111201', name: 'Gift Card Sleeve', sku: 'SLEEVE-1', quantity: 1, unitPriceMinor: 10 },
    ])
  })

  it('maps a cancelled guest order and a refunded one with a custom line', () => {
    const guest = mapShopifyOrder(shopifyOrder(1)).record!
    expect(guest.status).toBe('CANCELLED')
    expect(guest.customer).toEqual({ externalId: null, email: 'guest.shopper@example.org', name: 'Guest Shopper', phone: null })
    expect(guest.shippingAddress).toBeNull()

    const refunded = mapShopifyOrder(shopifyOrder(2)).record!
    expect(refunded.status).toBe('REFUNDED')
    // No total_shipping_price_set: the shipping lines are summed.
    expect(refunded.shippingMinor).toBe(50)
    expect(refunded.tipMinor).toBe(200)
    expect(refunded.note).toBeNull()
    expect(refunded.lines[0]!.sku).toBeNull()
    expect(refunded.lines[1]).toMatchObject({ productExternalId: null, variantExternalId: null, name: 'Gift wrapping', unitPriceMinor: 50 })
  })

  it('maps every Shopify status combination onto the order vocabulary', () => {
    const cases: Array<[Partial<ShopifyOrderPayload>, string]> = [
      [{ financial_status: 'pending', fulfillment_status: null }, 'PENDING'],
      [{ financial_status: 'authorized', fulfillment_status: null }, 'PROCESSING'],
      [{ financial_status: 'paid', fulfillment_status: null }, 'PROCESSING'],
      [{ financial_status: 'paid', fulfillment_status: 'partial' }, 'PROCESSING'],
      [{ financial_status: 'paid', fulfillment_status: 'fulfilled' }, 'SHIPPED'],
      [{ financial_status: 'partially_refunded', fulfillment_status: 'fulfilled' }, 'SHIPPED'],
      [{ financial_status: 'refunded', fulfillment_status: 'fulfilled' }, 'REFUNDED'],
      [{ financial_status: 'voided', fulfillment_status: null }, 'CANCELLED'],
      [{ financial_status: 'paid', fulfillment_status: null, cancelled_at: '2026-01-01T00:00:00Z' }, 'CANCELLED'],
    ]
    for (const [raw, status] of cases)
      expect(shopifyOrderStatus(raw).status).toBe(status as any)
    expect(shopifyOrderStatus({ financial_status: 'chargeback_pending' })).toEqual({ status: 'PENDING', mapped: false })
  })

  it('warns about an unmapped status and skips an order without a currency', () => {
    const order = shopifyOrder(0)
    order.financial_status = 'chargeback_pending'
    order.fulfillment_status = null
    expect(mapShopifyOrder(order).warnings).toEqual([{ externalId: '450789469', message: 'Shopify status "chargeback_pending, unfulfilled" has no Stacks equivalent; imported as PENDING' }])

    order.currency = null
    expect(mapShopifyOrder(order).record).toBeNull()
    expect(mapShopifyOrder(order, { currency: 'cad' }).record!.currency).toBe('CAD')
  })

  it('converts at the currency precision: JPY has none, KWD has three', () => {
    const yen = shopifyOrder(1)
    yen.currency = 'JPY'
    yen.total_price = '1200'
    yen.line_items![0]!.price = '1200'
    const mappedYen = mapShopifyOrder(yen).record!
    expect(mappedYen.totalMinor).toBe(1200)
    expect(mappedYen.lines[0]!.unitPriceMinor).toBe(1200)

    const dinar = shopifyOrder(1)
    dinar.currency = 'KWD'
    dinar.total_price = '12.345'
    expect(mapShopifyOrder(dinar).record!.totalMinor).toBe(12345)
  })
})

describe('WooCommerce REST API mapping', () => {
  it('maps customers, falling back to billing names and keeping only https avatars', () => {
    expect(mapWooCustomer(wooCustomer(0)).record).toEqual({
      source: 'woocommerce',
      externalId: '25',
      email: 'john.doe@example.com',
      name: 'John Doe',
      phone: '(555) 555-5555',
      active: null,
      totalSpentMinor: null,
      currency: null,
      lastOrderAt: null,
      avatarUrl: 'https://secure.gravatar.com/avatar/8eb1b522f60d11fa897de1dc6351b7e8?s=96',
      createdAt: '2026-01-15T10:00:00.000Z',
    })
    const mixed = mapWooCustomer(wooCustomer(1)).record!
    expect(mixed).toMatchObject({ email: 'mixed.case@example.co.uk', name: 'Mia Case', phone: null, avatarUrl: null })
  })

  it('maps an order with a variation, a coupon and a fee', () => {
    const { record, warnings } = mapWooOrder(wooOrder(0))
    expect(warnings).toEqual([])
    expect(record).toMatchObject({
      externalId: '727',
      number: '#727',
      currency: 'GBP',
      status: 'PROCESSING',
      totalMinor: 12724,
      taxMinor: 1775,
      discountMinor: 200,
      shippingMinor: 499,
      customer: { externalId: '25', email: 'john.doe@example.com', name: 'John Doe' },
      shippingAddress: 'John Doe, 12 Baker Street, Flat 2, London, NW1 6XE, GB',
      note: 'Ring the bell twice.',
      placedAt: '2026-09-14T09:12:44.000Z',
    })
    expect(record!.lines).toEqual([
      // Before the coupon: 45.00, not the 43.00 line total.
      { externalId: '315', productExternalId: '81', variantExternalId: null, name: 'Hoodie & Logo – Navy', sku: 'woo-hoodie-logo', quantity: 1, unitPriceMinor: 4500 },
      { externalId: '316', productExternalId: '90', variantExternalId: '91', name: 'V-Neck T-Shirt - Blue, L', sku: 'woo-vneck-tee-blue-l', quantity: 3, unitPriceMinor: 2000 },
      { externalId: 'fee-401', productExternalId: null, variantExternalId: null, name: 'Gift wrap', sku: null, quantity: 1, unitPriceMinor: 150 },
    ])
    // Payment fields are in the payload and nowhere in the record.
    expect(keysOf(record)).not.toContain('payment_method')
    expect(JSON.stringify(record)).not.toContain('ch_3NfakeChargeId')
  })

  it('skips drafts, treats a negative fee as discount, and rounds an uneven unit price', () => {
    expect(mapWooOrder(wooOrder(1))).toEqual({ record: null, warnings: [{ externalId: '728', message: 'skipped: status "checkout-draft" is not a placed order' }] })

    const guest = mapWooOrder(wooOrder(2)).record!
    expect(guest.status).toBe('DELIVERED')
    expect(guest.customer).toEqual({ externalId: null, email: 'guest@example.net', name: 'Gus Guest', phone: '07700 900123' })
    expect(guest.discountMinor).toBe(100)
    expect(guest.lines).toEqual([{ externalId: '330', productExternalId: '4242', variantExternalId: null, name: 'Sticker pack', sku: 'STICKERS-3', quantity: 3, unitPriceMinor: 333 }])
    expect(guest.shippingAddress).toBeNull()
  })

  it('maps every core status, and warns on a plugin status', () => {
    expect(['pending', 'on-hold', 'processing', 'completed', 'cancelled', 'failed', 'refunded'].map(status => wooOrderStatus(status).status))
      .toEqual(['PENDING', 'PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED', 'CANCELLED', 'REFUNDED'])
    const shipped = mapWooOrder(wooOrder(3))
    expect(shipped.record!.status).toBe('PENDING')
    expect(shipped.warnings).toEqual([{ externalId: '730', message: 'WooCommerce status "shipped" has no Stacks equivalent; imported as PENDING' }])
  })
})

describe('Shopware Admin API mapping', () => {
  it('maps customers, with disabled accounts inactive', () => {
    expect(mapShopwareCustomer(swCustomer(0), { currency: 'EUR' }).record).toEqual({
      source: 'shopware',
      externalId: '0190c0ffee0a4b5c8d9e0f1a2b3c4d01',
      email: 'anna.schmidt@example.de',
      name: 'Anna Schmidt',
      phone: '+49 30 1234567',
      active: true,
      totalSpentMinor: 11995,
      currency: 'EUR',
      lastOrderAt: '2026-09-20T14:03:11.000Z',
      avatarUrl: null,
      createdAt: '2025-11-02T09:41:00.000Z',
    })
    const max = mapShopwareCustomer(swCustomer(2)).record!
    expect(max).toMatchObject({ active: false, totalSpentMinor: 199950, phone: null })
  })

  it('maps an order: promotion as discount, tax as gross minus net, variant lines', () => {
    const { record, warnings } = mapShopwareOrder(swOrder(0))
    expect(warnings).toEqual([])
    expect(record).toMatchObject({
      externalId: '0190d00d0a4b5c8d9e0f1a2b3c4d5e01',
      number: '10042',
      currency: 'EUR',
      status: 'DELIVERED',
      totalMinor: 11939,
      taxMinor: 1906,
      discountMinor: 1000,
      shippingMinor: 499,
      customer: { externalId: '0190c0ffee0a4b5c8d9e0f1a2b3c4d01', email: 'anna.schmidt@example.de', name: 'Anna Schmidt', phone: '+49 30 1234567' },
      // The delivery's address, not the billing one.
      shippingAddress: 'Anna Schmidt, Gartenweg 12, Hinterhaus, 10117 Berlin, DE',
      note: 'Bitte beim Nachbarn abgeben.',
    })
    expect(record!.lines).toEqual([
      { externalId: '0190d00d0a4b5c8d9e0f1a2b3c4dl001', productExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a61', variantExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b01', name: 'Linen Shirt Classic', sku: 'SW10001.1', quantity: 2, unitPriceMinor: 4995 },
      { externalId: '0190d00d0a4b5c8d9e0f1a2b3c4dl002', productExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a62', variantExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a62', name: 'Espresso Cup Set', sku: 'SW10002', quantity: 1, unitPriceMinor: 2450 },
    ])
  })

  it('keeps each order in its own currency, and ships nothing without a delivery', () => {
    const chf = mapShopwareOrder(swOrder(1)).record!
    expect(chf).toMatchObject({ currency: 'CHF', status: 'PENDING', totalMinor: 5990, taxMinor: 428, shippingAddress: null })
    // No parentId in the payload: the variant identity finds the product.
    expect(chf.lines[0]).toMatchObject({ productExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b02', variantExternalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b02' })
  })

  it('combines the order, delivery and latest payment states', () => {
    const state = (order: string, delivery?: string, ...payments: string[]) => shopwareOrderStatus({
      stateMachineState: { technicalName: order },
      deliveries: delivery ? [{ stateMachineState: { technicalName: delivery } }] : [],
      transactions: payments.map((payment, index) => ({ createdAt: `2026-01-0${index + 1}T00:00:00Z`, stateMachineState: { technicalName: payment } })),
    } as any).status

    expect(state('open', 'open', 'open')).toBe('PENDING')
    expect(state('open', 'open', 'failed', 'paid')).toBe('PROCESSING')
    expect(state('open', 'open', 'paid', 'failed')).toBe('PENDING')
    expect(state('in_progress', 'open', 'paid')).toBe('PROCESSING')
    expect(state('in_progress', 'shipped', 'paid')).toBe('SHIPPED')
    expect(state('completed', 'shipped', 'paid')).toBe('DELIVERED')
    expect(state('cancelled', 'cancelled', 'cancelled')).toBe('CANCELLED')
    expect(state('completed', 'returned', 'refunded')).toBe('REFUNDED')
    expect(shopwareOrderStatus({ stateMachineState: { technicalName: 'on_hold_custom' } } as any)).toMatchObject({ status: 'PENDING', mapped: false })
  })
})

describe('never imports secrets', () => {
  it('carries no password or card field from any source', () => {
    const records = [
      ...shopifyCustomers.customers.map(raw => mapShopifyCustomer(raw as any).record),
      ...shopifyOrders.orders.map(raw => mapShopifyOrder(raw as any).record),
      ...wooCustomers.map(raw => mapWooCustomer({ ...raw, password: 'hunter2' } as any).record),
      ...wooOrders.map(raw => mapWooOrder(raw as any).record),
      ...shopwareCustomers.data.map(raw => mapShopwareCustomer({ ...raw, password: '$2y$10$hash', legacyPassword: 'md5' } as any).record),
      ...shopwareOrders.data.map(raw => mapShopwareOrder(raw as any).record),
    ]
    const keys = new Set(records.flatMap(keysOf))
    for (const forbidden of ['password', 'legacyPassword', 'payment_method', 'transaction_id', 'card', 'credit_card_number'])
      expect(keys.has(forbidden)).toBe(false)
    expect(JSON.stringify(records)).not.toContain('hunter2')
    expect(JSON.stringify(records)).not.toContain('$2y$10$hash')
  })
})
