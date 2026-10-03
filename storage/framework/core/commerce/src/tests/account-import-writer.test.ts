import type { AccountAdapter, AccountCustomer, AccountOrder, CatalogAdapter, CatalogProduct, ShopifyProductPayload, ShopwareProductPayload } from '../imports'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database/runtime'
import { DEFAULT_CUSTOMER_AVATAR } from '../customers/store'
import {
  catalogUuid,
  createDatabaseAccountRepository,
  createDatabaseRepository,
  createMemoryAccountRepository,
  createMemoryRepository,
  createReadOnlyAccountRepository,
  customerUuid,
  importCatalog,
  importCustomers,
  importOrders,
  mapShopifyCustomer,
  mapShopifyOrder,
  mapShopifyProduct,
  mapShopwareCustomer,
  mapShopwareOrder,
  mapShopwareProduct,
  mapWooCustomer,
} from '../imports'
import shopifyCustomers from './fixtures/account-import/shopify-customers.json'
import shopifyOrders from './fixtures/account-import/shopify-orders.json'
import shopwareCustomers from './fixtures/account-import/shopware-customers.json'
import shopwareOrders from './fixtures/account-import/shopware-orders.json'
import wooCustomers from './fixtures/account-import/woocommerce-customers.json'
import shopifyProducts from './fixtures/catalog-import/shopify-products.json'
import shopwareProducts from './fixtures/catalog-import/shopware-products.json'
import shopwareVariants from './fixtures/catalog-import/shopware-variants.json'
import { refreshDatabase } from './setup'

/**
 * Writing imported customers and orders, against the in-memory repository and
 * the package's SQLite harness (see ./setup.ts), whose tables are generated
 * from the real models.
 *
 * What matters most: a re-run updates and never duplicates (customers by
 * email, orders by their derived uuid, lines replaced), and an order's lines
 * land on the products the catalog import wrote.
 */

const SHOP = 'https://shop.example.com'
const SHOPWARE = 'https://shop.example.de'
const NOW = () => new Date('2026-10-02T12:00:00Z')
const credentials = { source: 'shopify', accessToken: 'unused' } as const

function catalogAdapter(name: string, products: CatalogProduct[]): CatalogAdapter {
  return {
    name,
    async* pages(storeUrl) {
      yield { url: `${storeUrl}/catalog`, products, warnings: [] }
    },
  }
}

function accountAdapter(name: string, customers: AccountCustomer[][], orders: AccountOrder[][]): AccountAdapter {
  return {
    name,
    async* customers(storeUrl) {
      for (const [index, items] of customers.entries())
        yield { url: `${storeUrl}/customers/${index + 1}`, items, warnings: [] }
    },
    async* orders(storeUrl) {
      for (const [index, items] of orders.entries())
        yield { url: `${storeUrl}/orders/${index + 1}`, items, warnings: [] }
    },
  }
}

const shopifyCatalog = () => (structuredClone(shopifyProducts.products) as unknown as ShopifyProductPayload[])
  .map(raw => mapShopifyProduct(raw, { storeUrl: SHOP, currency: 'USD' }).product)
const shopifyAccountCustomers = () => shopifyCustomers.customers.map(raw => mapShopifyCustomer(structuredClone(raw) as any).record).filter((record): record is AccountCustomer => record !== null)
const shopifyAccountOrders = () => shopifyOrders.orders.map(raw => mapShopifyOrder(structuredClone(raw) as any).record!)
const shopify = (orders = [shopifyAccountOrders()]) => accountAdapter('shopify', [shopifyAccountCustomers()], orders)

function shopwareCatalog(): CatalogProduct[] {
  const variants = (shopwareVariants as any).elements as ShopwareProductPayload[]
  return ((shopwareProducts as any).elements as ShopwareProductPayload[]).map(raw => mapShopwareProduct(raw, {
    storeUrl: SHOPWARE,
    currency: 'EUR',
    children: variants.filter(variant => variant.parentId === raw.id),
  }).product)
}

async function rows(table: string): Promise<any[]> {
  return await (db as any).selectFrom(table).selectAll().orderBy('id').execute()
}

describe('importOrders into memory', () => {
  it('links lines to the imported catalog, and re-runs without duplicating anything', async () => {
    const catalog = createMemoryRepository()
    await importCatalog({ adapter: catalogAdapter('shopify', shopifyCatalog()), storeUrl: SHOP, repository: catalog, now: NOW })
    const repository = createMemoryAccountRepository(catalog)

    const customers = await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    expect(customers.counts).toEqual({ customers: { created: 2, updated: 0 }, merged: 0 })

    const first = await importOrders({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    expect(first.counts).toEqual({
      orders: { created: 3, updated: 0 },
      // The guest on #1002 had no customer record anywhere.
      customers: { created: 1, updated: 0 },
      lines: { linked: 3, unlinked: 2 },
      duplicates: 0,
    })
    expect(first.warnings.map(warning => warning.message)).toEqual([
      '2 order lines reference products not in Stacks (e.g. "Vintage Mug (SKU MUG-1)", "Gift wrapping"); kept with their label and price but no product link. Import the catalog (buddy commerce:import <url> --from shopify), then re-run the order import to link them.',
    ])

    const tee = repository.tables.products!.find(product => product.uuid === catalogUuid('shopify', 'shop.example.com', 'product', '7612345678901'))!
    const items = repository.tables.order_items!
    expect(items.map(item => [item.product_id, item.quantity, item.price, item.special_instructions])).toEqual([
      [tee.id, 2, 2400, 'Organic Cotton Tee - S / Black (SKU TEE-S-BLK)'],
      [expect.any(Number), 1, 10, 'Gift Card Sleeve (SKU SLEEVE-1)'],
      [null, 1, 1200, 'Vintage Mug (SKU MUG-1)'],
      [tee.id, 1, 2650, 'Organic Cotton Tee - L / Natural'],
      [null, 1, 50, 'Gift wrapping'],
    ])

    const second = await importOrders({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    expect(second.counts.orders).toEqual({ created: 0, updated: 3 })
    expect(second.counts.customers).toEqual({ created: 0, updated: 0 })
    expect(repository.tables.orders).toHaveLength(3)
    expect(repository.tables.order_items).toHaveLength(5)
    expect(repository.tables.customers).toHaveLength(3)
  })

  it('merges source customers that share an email, and links their orders to the one row', async () => {
    const catalog = createMemoryRepository()
    await importCatalog({ adapter: catalogAdapter('shopware', shopwareCatalog()), storeUrl: SHOPWARE, repository: catalog, now: NOW })
    const repository = createMemoryAccountRepository(catalog)
    const adapter = accountAdapter(
      'shopware',
      [shopwareCustomers.data.map(raw => mapShopwareCustomer(raw as any, { currency: 'EUR' }).record!)],
      [shopwareOrders.data.map(raw => mapShopwareOrder(raw as any).record!)],
    )

    const customers = await importCustomers({ adapter, storeUrl: SHOPWARE, repository, credentials, now: NOW })
    // Anna's guest account (same email, other case) is the same shopper.
    expect(customers.counts).toEqual({ customers: { created: 2, updated: 0 }, merged: 1 })
    expect(repository.tables.customers!.map(row => [row.email, row.status, row.total_spent])).toEqual([
      ['anna.schmidt@example.de', 'Active', 11995],
      ['max.muster@example.de', 'Inactive', 199950],
    ])

    const orders = await importOrders({ adapter, storeUrl: SHOPWARE, repository, credentials, now: NOW })
    expect(orders.counts.lines).toEqual({ linked: 3, unlinked: 0 })
    expect(orders.currencies).toEqual(['CHF', 'EUR'])

    const [eur, chf] = repository.tables.orders!
    expect(eur).toMatchObject({ customer_id: 1, currency: 'EUR', status: 'DELIVERED', total_amount: 11939, tax_amount: 1906, discount_amount: 1000, delivery_fee: 499, order_type: 'DELIVERY' })
    // Nina was never imported as a customer: her order creates her.
    expect(chf).toMatchObject({ customer_id: 3, currency: 'CHF', status: 'PENDING', total_amount: 5990, order_type: 'TAKEOUT' })
    expect(repository.tables.customers![2]).toMatchObject({
      email: 'new.buyer@example.ch',
      name: 'Nina Buyer',
      uuid: customerUuid('shopware', 'shop.example.de', '0190c0ffee0a4b5c8d9e0f1a2b3c4d99', ''),
      avatar: DEFAULT_CUSTOMER_AVATAR,
    })

    // Both variant lines resolve to the Linen Shirt parent, with or without payload.parentId.
    const shirt = catalog.tables.products!.find(product => product.uuid === catalogUuid('shopware', 'shop.example.de', 'product', '0190a1b2c3d47e8f9a0b1c2d3e4f5a61'))!
    expect(repository.tables.order_items!.map(item => item.product_id)).toEqual([shirt.id, expect.any(Number), shirt.id])
  })

  it('follows a changed email by source id, unless another customer holds it', async () => {
    const repository = createMemoryAccountRepository()
    const run = (customers: AccountCustomer[]) => importCustomers({ adapter: accountAdapter('woocommerce', [customers], []), storeUrl: 'https://example.co.uk', repository, credentials, now: NOW })
    const [john, mia] = wooCustomers.map(raw => mapWooCustomer(raw as any).record!)
    await run([john!, mia!])

    const moved = await run([{ ...john!, email: 'john.new@example.com' }])
    expect(moved.customers[0]).toMatchObject({ action: 'update', matchedBy: 'uuid' })
    expect(repository.tables.customers![0]!.email).toBe('john.new@example.com')

    const clash = await run([{ ...john!, email: 'mixed.case@example.co.uk' }])
    expect(clash.warnings[0]!.message).toBe('email changed to mixed.case@example.co.uk, which another customer already has; kept the old address')
    expect(repository.tables.customers!.map(row => row.email)).toEqual(['john.new@example.com', 'mixed.case@example.co.uk'])
  })
})

describe('importCustomers and importOrders into the database', () => {
  beforeEach(async () => {
    await refreshDatabase()
  })

  it('writes customers, orders and lines with the columns the models define', async () => {
    await importCatalog({ adapter: catalogAdapter('shopify', shopifyCatalog()), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })
    const repository = createDatabaseAccountRepository()
    await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    await importOrders({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })

    const customers = await rows('customers')
    expect(customers.map(row => row.email)).toEqual(['bob.norman@mail.example.com', 'jane.roe@example.com', 'guest.shopper@example.org'])
    expect(customers[0]).toMatchObject({
      uuid: customerUuid('shopify', 'shop.example.com', '207119551', ''),
      name: 'Bob Norman',
      phone: '+16136120707',
      total_spent: 19965,
      status: 'Active',
      avatar: DEFAULT_CUSTOMER_AVATAR,
      created_at: '2025-03-04 16:20:00',
    })

    const orders = await rows('orders')
    expect(orders).toHaveLength(3)
    expect(orders[0]).toMatchObject({
      uuid: catalogUuid('shopify', 'shop.example.com', 'order', '450789469'),
      status: 'SHIPPED',
      total_amount: 5449,
      currency: 'USD',
      tax_amount: 389,
      discount_amount: 500,
      delivery_fee: 750,
      tip_amount: 0,
      order_type: 'DELIVERY',
      delivery_address: 'Bob Norman, Chestnut Street 92, Apt 4, Louisville, KY 40202, US',
      special_instructions: 'Please leave at the side door.',
      customer_id: customers[0].id,
      created_at: '2026-09-10 15:00:00',
    })
    expect(orders[1]).toMatchObject({ status: 'CANCELLED', order_type: 'TAKEOUT', customer_id: customers[2].id })
    expect(orders[2]).toMatchObject({ status: 'REFUNDED', customer_id: customers[0].id, tip_amount: 200 })

    const products = await rows('products')
    const items = await rows('order_items')
    expect(items.map(item => [item.order_id, item.product_id, item.quantity, item.price])).toEqual([
      [orders[0].id, products[0].id, 2, 2400],
      [orders[0].id, products[1].id, 1, 10],
      [orders[1].id, null, 1, 1200],
      [orders[2].id, products[0].id, 1, 2650],
      [orders[2].id, null, 1, 50],
    ])
  })

  it('updates on a re-run, links lines once the catalog arrives, and never duplicates', async () => {
    const repository = createDatabaseAccountRepository()
    // Orders first: nothing to link to yet.
    const before = await importOrders({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    expect(before.counts.lines).toEqual({ linked: 0, unlinked: 5 })

    await importCatalog({ adapter: catalogAdapter('shopify', shopifyCatalog()), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })

    // The merchant refunds #1001 at the source meanwhile.
    const changed = shopifyAccountOrders()
    changed[0] = { ...changed[0]!, status: 'REFUNDED', sourceStatus: 'refunded, fulfilled' }
    const after = await importOrders({ adapter: shopify([changed]), storeUrl: SHOP, repository, credentials, now: NOW })

    expect(after.counts).toEqual({ orders: { created: 0, updated: 3 }, customers: { created: 0, updated: 0 }, lines: { linked: 3, unlinked: 2 }, duplicates: 0 })
    expect(await rows('orders')).toHaveLength(3)
    expect((await rows('orders'))[0].status).toBe('REFUNDED')
    expect(await rows('order_items')).toHaveLength(5)
    expect((await rows('order_items')).filter(item => item.product_id !== null)).toHaveLength(3)
    expect(await rows('customers')).toHaveLength(2)

    await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW })
    // Bob was created from his order and is now matched by his source id.
    expect((await rows('customers')).map(row => row.email)).toEqual(['bob.norman@mail.example.com', 'guest.shopper@example.org', 'jane.roe@example.com'])
  })

  it('matches a customer who already exists in Stacks by email, whatever its case', async () => {
    await (db as any).insertInto('customers').values({
      uuid: '0190f000-0000-7000-8000-000000000001',
      name: 'Robert Norman',
      email: 'BOB.Norman@Mail.Example.com',
      total_spent: 500,
      status: 'Active',
      avatar: 'https://cdn.example.com/bob.png',
      created_at: '2024-01-01 00:00:00',
      updated_at: '2024-01-01 00:00:00',
    }).execute()

    const result = await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository: createDatabaseAccountRepository(), credentials, now: NOW })
    expect(result.customers[0]).toMatchObject({ action: 'update', matchedBy: 'email' })

    const customers = await rows('customers')
    expect(customers).toHaveLength(2)
    // The existing row keeps its identity, address and avatar; the source updates the rest.
    expect(customers[0]).toMatchObject({
      uuid: '0190f000-0000-7000-8000-000000000001',
      email: 'BOB.Norman@Mail.Example.com',
      name: 'Bob Norman',
      total_spent: 19965,
      avatar: 'https://cdn.example.com/bob.png',
    })

    await importOrders({ adapter: shopify(), storeUrl: SHOP, repository: createDatabaseAccountRepository(), credentials, now: NOW })
    expect((await rows('orders'))[0].customer_id).toBe(customers[0].id)
  })

  it('a dry run reads the database and writes nothing', async () => {
    const repository = createReadOnlyAccountRepository(createDatabaseAccountRepository())
    const customers = await importCustomers({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW, dryRun: true })
    const orders = await importOrders({ adapter: shopify(), storeUrl: SHOP, repository, credentials, now: NOW, dryRun: true })

    expect(customers.dryRun).toBe(true)
    expect(customers.counts.customers.created).toBe(2)
    expect(orders.counts.orders.created).toBe(3)
    expect(orders.counts.customers.created).toBe(1)
    for (const table of ['customers', 'orders', 'order_items'])
      expect(await rows(table)).toEqual([])
  })
})
