import type { AccountAdapter, AccountCustomer, AccountOrder, CatalogAdapter, WooOrderPayload, WooProductPayload } from '../imports'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database/runtime'
import {
  catalogUuid,
  createDatabaseAccountRepository,
  createMemoryAccountRepository,
  createMemoryRepository,
  customerUuid,
  importCatalog,
  importCustomers,
  importOrders,
  mapShopwareOrder,
  mapWooCustomer,
  mapWooOrder,
  mapWooProduct,
  promotedCustomerUuid,
  shopwareLineLabel,
  wooSlug,
} from '../imports'
import shopwareOrders from './fixtures/account-import/shopware-live-orders.json'
import wooCustomers from './fixtures/account-import/woocommerce-live-customers.json'
import wooOrders from './fixtures/account-import/woocommerce-live-orders.json'
import wooCatalog from './fixtures/account-import/woocommerce-live-products.json'
import { refreshDatabase } from './setup'

/**
 * Recorded from live stores (stacksjs/stacks#2853): WooCommerce 11.1.2 on
 * WordPress 7.1.2 and Shopware 6.7.15.0, both on PHP 8.5.8 and MySQL 9.2.0
 * installed with pantry, seeded with the cases below and read through the
 * same REST/Admin API requests the importer makes. Only the records the tests
 * use are kept, with links, meta data and avatars removed and the host
 * renamed. These are the payloads that surfaced:
 *
 * - fee lines and deleted products reported as "products not in Stacks",
 *   with advice to import the catalog that could never help;
 * - a partial refund dropped without a word;
 * - `customers.last_order` left at the first order seen;
 * - a guest promoted to an account duplicated once it changed address;
 * - Shopware variant lines that all read "Bio T-Shirt".
 */

const WOO = 'https://shop.example.com'
const NOW = () => new Date('2026-10-04T12:00:00Z')
const credentials = { source: 'woocommerce', consumerKey: 'unused', consumerSecret: 'unused' } as const

const orders = wooOrders as unknown as WooOrderPayload[]
const order = (id: number) => mapWooOrder(structuredClone(orders.find(raw => raw.id === id)!)).record!

function wooProducts() {
  const variations = new Map((wooCatalog.variations as unknown as WooProductPayload[]).map(raw => [String(raw.id), raw]))
  return (wooCatalog.products as unknown as WooProductPayload[]).map(raw => mapWooProduct(structuredClone(raw), { variations }).product)
}

function adapters(customers: AccountCustomer[], orderList: AccountOrder[]): { catalog: CatalogAdapter, accounts: AccountAdapter } {
  return {
    catalog: {
      name: 'woocommerce',
      async* pages(storeUrl) {
        yield { url: `${storeUrl}/products`, products: wooProducts(), warnings: [] }
      },
    },
    accounts: {
      name: 'woocommerce',
      async* customers(storeUrl) {
        yield { url: `${storeUrl}/customers`, items: customers, warnings: [] }
      },
      async* orders(storeUrl) {
        yield { url: `${storeUrl}/orders`, items: orderList, warnings: [] }
      },
    },
  }
}

const allCustomers = () => wooCustomers.map(raw => mapWooCustomer(structuredClone(raw) as any).record!)
const allOrders = () => orders.map(raw => mapWooOrder(structuredClone(raw)).record!)

describe('WooCommerce, recorded from a live store', () => {
  it('maps refunds, fees, a deleted product and a zero-decimal currency', () => {
    // Zoë: two variations, a coupon, a gift-wrap fee.
    const zoe = order(39)
    expect(zoe).toMatchObject({ currency: 'USD', totalMinor: 10165, discountMinor: 1035, shippingMinor: 500, refundedMinor: 0 })
    expect(zoe.lines.map(line => [line.name, line.productExternalId, line.variantExternalId, line.quantity, line.unitPriceMinor])).toEqual([
      ['Organic T-Shirt - Navy Blue, M', '27', '29', 2, 2100],
      ['Organic T-Shirt - Rot, XL', '27', '36', 1, 1800],
      ['Café Crème Mug', '10', null, 3, 1450],
      ['Gift wrap', null, null, 1, 350],
    ])

    // Refunded in part, still completed; and refunded in full.
    expect(order(41)).toMatchObject({ status: 'DELIVERED', currency: 'EUR', totalMinor: 5996, refundedMinor: 999 })
    expect(order(43)).toMatchObject({ status: 'REFUNDED', totalMinor: 2400, refundedMinor: 2400 })

    // A JPY order: whole yen, the store's two decimals rounded away.
    expect(order(45)).toMatchObject({ currency: 'JPY', totalMinor: 826, shippingMinor: 800 })

    // The kettle was deleted after the sale (product_id 0); the negative fee is a discount.
    const doomed = order(50)
    expect(doomed.lines[0]).toMatchObject({ name: 'Discontinued Kettle', productExternalId: null, variantExternalId: null, unitPriceMinor: 3900 })
    expect(doomed.discountMinor).toBe(400)
  })

  it('links every product line to the catalog, and reports fees, deleted products and refunds for what they are', async () => {
    const { catalog: catalogSource, accounts } = adapters(allCustomers(), allOrders())
    const catalog = createMemoryRepository()
    await importCatalog({ adapter: catalogSource, storeUrl: WOO, repository: catalog, now: NOW })
    const repository = createMemoryAccountRepository(catalog)

    await importCustomers({ adapter: accounts, storeUrl: WOO, repository, credentials, now: NOW })
    const result = await importOrders({ adapter: accounts, storeUrl: WOO, repository, credentials, now: NOW })

    // The gift-wrap fee and the deleted kettle name no product; nothing waits on the catalog.
    expect(result.counts.lines).toEqual({ linked: 14, unlinked: 0, productless: 2 })
    expect(result.counts.partlyRefunded).toBe(1)
    expect(result.warnings.map(warning => warning.message)).toEqual([
      '1 order was partly refunded at the source (#41: 9.99 EUR of 59.96 EUR). Stacks orders have no refund column, so total_amount is what was charged.',
    ])

    // Line items carry the catalog's own product ids, by deterministic uuid.
    const tee = catalog.tables.products!.find(row => row.uuid === catalogUuid('woocommerce', 'shop.example.com', 'product', '27'))!
    const zoeOrder = repository.tables.orders!.find(row => row.uuid === catalogUuid('woocommerce', 'shop.example.com', 'order', '39'))!
    expect(repository.tables.order_items!.filter(item => item.order_id === zoeOrder.id).map(item => item.product_id)).toEqual([tee.id, tee.id, expect.any(Number), null])
  })

  it('moves last_order to the latest order, and never back', async () => {
    const { accounts } = adapters([], allOrders())
    const repository = createMemoryAccountRepository()
    await importOrders({ adapter: accounts, storeUrl: WOO, repository, credentials, now: NOW })

    // Gary checked out as a guest twice (one address in two cases), then once with an account.
    const gary = repository.tables.customers!.filter(row => row.email === 'gary.guest@example.net')
    expect(gary).toHaveLength(1)
    expect(gary[0]!.last_order).toBe('2026-09-30 12:00:00')

    await repository.advanceLastOrder!(gary[0]!.id, '2026-01-01 00:00:00')
    expect(gary[0]!.last_order).toBe('2026-09-30 12:00:00')
  })

  it('gives a guest row the account\'s uuid once the shopper has one, so a later change of address updates it', async () => {
    const guestOrders = allOrders().filter(o => o.customer?.externalId === null)
    const repository = createMemoryAccountRepository()
    await importOrders({ adapter: adapters([], guestOrders).accounts, storeUrl: WOO, repository, credentials, now: NOW })
    const guest = repository.tables.customers!.find(row => row.email === 'gary.guest@example.net')!
    expect(guest.uuid).toBe(customerUuid('woocommerce', 'shop.example.com', null, 'gary.guest@example.net'))

    // Gary registers (customer 118, same address): the customer import adopts the row.
    const gary = allCustomers().find(c => c.externalId === '118')!
    const first = await importCustomers({ adapter: adapters([gary], []).accounts, storeUrl: WOO, repository, credentials, now: NOW })
    expect(first.customers[0]).toMatchObject({ action: 'update', matchedBy: 'email' })
    expect(guest.uuid).toBe(customerUuid('woocommerce', 'shop.example.com', '118', 'gary.guest@example.net'))

    // ...and follows him to a new address instead of creating a second Gary.
    const moved = { ...gary, email: 'gary@newmail.example' }
    const second = await importCustomers({ adapter: adapters([moved], []).accounts, storeUrl: WOO, repository, credentials, now: NOW })
    expect(second.customers[0]).toMatchObject({ action: 'update', matchedBy: 'uuid' })
    expect(repository.tables.customers!.filter(row => row.name.startsWith('Gary'))).toHaveLength(1)
    expect(guest.email).toBe('gary@newmail.example')
  })

  it('adopts the account uuid from an order alone, when only orders are imported', async () => {
    const repository = createMemoryAccountRepository()
    await importOrders({ adapter: adapters([], allOrders()).accounts, storeUrl: WOO, repository, credentials, now: NOW })
    const gary = repository.tables.customers!.find(row => row.email === 'gary.guest@example.net')!
    // Orders 46 and 47 were guest checkouts; 166 names account 118 for the same address.
    expect(gary.uuid).toBe(customerUuid('woocommerce', 'shop.example.com', '118', 'gary.guest@example.net'))
  })

  it('never adopts over a uuid the import did not derive from that email', () => {
    const host = 'shop.example.com'
    const email = 'gary.guest@example.net'
    expect(promotedCustomerUuid('woocommerce', host, customerUuid('woocommerce', host, null, email), '118', email)).toBe(customerUuid('woocommerce', host, '118', email))
    // A row made by checkout, the dashboard or another store keeps its own.
    expect(promotedCustomerUuid('woocommerce', host, '0190f000-0000-7000-8000-000000000001', '118', email)).toBeNull()
    expect(promotedCustomerUuid('woocommerce', host, customerUuid('woocommerce', 'other.example.com', null, email), '118', email)).toBeNull()
    // A guest has no account to adopt.
    expect(promotedCustomerUuid('woocommerce', host, customerUuid('woocommerce', host, null, email), null, email)).toBeNull()
  })

  it('reads a non-ASCII slug the way the shopper does', () => {
    expect(wooSlug('sencha-%e7%b7%91%e8%8c%b6-100g')).toBe('sencha-緑茶-100g')
    expect(wooSlug('cafe-creme-mug')).toBe('cafe-creme-mug')
    expect(wooSlug('broken-%e7%b7')).toBe('broken-%e7%b7')
    expect(wooProducts().find(product => product.externalId === '11')!.handle).toBe('sencha-緑茶-100g')
  })
})

describe('the database repository', () => {
  beforeEach(async () => {
    await refreshDatabase()
  })

  it('moves last_order forward, never back', async () => {
    const repository = createDatabaseAccountRepository()
    const id = await repository.createCustomer({ uuid: '0190f000-0000-7000-8000-0000000000aa', name: 'Gary', email: 'gary@example.net', avatar: 'https://cdn.example.com/gary.png', last_order: null, updated_at: '2026-10-04 00:00:00' })
    const lastOrder = async () => ((await (db as any).selectFrom('customers').where('id', '=', id).select('last_order').executeTakeFirst()).last_order)

    await repository.advanceLastOrder!(id, '2026-08-10 09:00:00')
    expect(await lastOrder()).toBe('2026-08-10 09:00:00')
    await repository.advanceLastOrder!(id, '2026-09-30 12:00:00')
    expect(await lastOrder()).toBe('2026-09-30 12:00:00')
    await repository.advanceLastOrder!(id, '2026-08-11 09:00:00')
    expect(await lastOrder()).toBe('2026-09-30 12:00:00')
  })
})

describe('Shopware, recorded from a live store', () => {
  const sw = (number: string) => mapShopwareOrder(structuredClone((shopwareOrders.data as any[]).find(raw => raw.orderNumber === number))).record!

  it('labels variant lines with their options', () => {
    expect(sw('10000').lines.map(line => [line.name, line.sku, line.quantity, line.unitPriceMinor])).toEqual([
      ['Bio T-Shirt - Blau, M', 'SW-TEE-Blau-M', 2, 2350],
      ['Bio T-Shirt - Grün, S', 'SW-TEE-Grün-S', 1, 2100],
      ['Café Crème Tasse', 'SW-MUG', 3, 1450],
    ])
    // The promotion line is the order's discount, not a line.
    expect(sw('10000')).toMatchObject({ status: 'SHIPPED', totalMinor: 10035, taxMinor: 2007, discountMinor: 1115 })
    expect(shopwareLineLabel('Tee', [{ group: 'Size', option: 'S' }])).toBe('Tee - S')
    expect(shopwareLineLabel('Tee - S', [{ group: 'Size', option: 'S' }])).toBe('Tee - S')
    expect(shopwareLineLabel('Tee', null)).toBe('Tee')
  })

  it('maps currencies and refund states', () => {
    expect(sw('10001')).toMatchObject({ currency: 'USD', status: 'REFUNDED' })
    expect(sw('10003')).toMatchObject({ currency: 'JPY', totalMinor: 5358 })
  })

  it('treats a line whose product was deleted as naming none', () => {
    const [kettle, tea] = sw('10007').lines
    // Shopware nulls productId on delete and keeps referencedId.
    expect(kettle).toMatchObject({ name: 'Auslaufmodell Wasserkocher', productExternalId: null, variantExternalId: null, unitPriceMinor: 3900 })
    expect(tea!.productExternalId).not.toBeNull()
  })
})
