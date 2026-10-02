import type { CatalogAdapter, CatalogProduct, ShopifyProductPayload, WooProductPayload } from '../imports'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database/runtime'
import {
  catalogUuid,
  createDatabaseRepository,
  createMemoryRepository,
  createReadOnlyRepository,
  importCatalog,
  mapShopifyProduct,
  mapWooProduct,
  productRow,
  SKU_MAX,
  variantRow,
  variantSkus,
} from '../imports'
import shopifyFixture from './fixtures/catalog-import/shopify-products.json'
import wooProducts from './fixtures/catalog-import/woocommerce-products.json'
import wooVariations from './fixtures/catalog-import/woocommerce-variations.json'
import { refreshDatabase } from './setup'

/**
 * Writing the normalized catalog into the commerce tables, against the
 * package's SQLite harness (see ./setup.ts), so the columns are the ones the
 * models really generate.
 *
 * The property that matters most is idempotency: a merchant runs the import,
 * notices a price was wrong at the source, fixes it and runs it again. That
 * second run must update in place, never add a second copy of the catalog.
 */

const SHOP = 'https://shop.example.com'
const WOO = 'https://shop.example.co.uk'
const NOW = () => new Date('2026-10-02T12:00:00Z')

function shopifyProducts(overrides: (raw: ShopifyProductPayload[]) => ShopifyProductPayload[] = raw => raw): CatalogProduct[] {
  const raw = overrides(structuredClone(shopifyFixture.products) as unknown as ShopifyProductPayload[])
  return raw.map(entry => mapShopifyProduct(entry, { storeUrl: SHOP, currency: 'USD' }).product)
}

function wooCatalog(): CatalogProduct[] {
  const variations = new Map((wooVariations as unknown as WooProductPayload[]).map(variation => [String(variation.id), variation]))
  return (wooProducts as unknown as WooProductPayload[]).map(entry => mapWooProduct(entry, { variations }).product)
}

/** An adapter that serves already-mapped products, one page each call. */
function staticAdapter(name: string, ...pages: CatalogProduct[][]): CatalogAdapter {
  return {
    name,
    async* pages(storeUrl) {
      for (const [index, products] of pages.entries())
        yield { url: `${storeUrl}/page/${index + 1}`, products, warnings: [] }
    },
  }
}

async function rows(table: string): Promise<any[]> {
  return await (db as any).selectFrom(table).selectAll().orderBy('id').execute()
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('importCatalog into the database', () => {
  it('writes products, variants, categories and manufacturers', async () => {
    const result = await importCatalog({
      adapter: staticAdapter('shopify', shopifyProducts()),
      storeUrl: SHOP,
      repository: createDatabaseRepository(),
      now: NOW,
    })

    expect(result.counts).toEqual({
      products: { created: 3, updated: 0 },
      variants: { created: 3, updated: 0 },
      categories: { created: 2, updated: 0 },
      manufacturers: { created: 1, updated: 0 },
      duplicates: 0,
    })

    const products = await rows('products')
    expect(products.map(product => product.name)).toEqual(['Organic Cotton Tee', 'Gift Card Sleeve', 'Archived Sample'])

    const tee = products[0]
    expect(tee.uuid).toBe(catalogUuid('shopify', 'shop.example.com', 'product', '7612345678901'))
    expect(tee.price).toBe(2400)
    expect(tee.description).toBe('<p>Soft, breathable and <strong>100% organic</strong> cotton.</p>')
    expect(tee.image_url).toBe('https://cdn.shopify.com/s/files/1/0000/0001/products/tee-front.jpg?v=1709565162')
    expect(Boolean(tee.is_available)).toBe(true)

    // Columns the dashboard refuses to render without.
    for (const product of products) {
      expect(product.inventory_count).toBe(0)
      expect(product.preparation_time).toBeGreaterThanOrEqual(1)
      expect(product.created_at).toBe('2026-10-02 12:00:00')
    }

    // A product with no variants is unpriced, unavailable, and still imported.
    expect(products[2].price).toBe(0)
    expect(Boolean(products[2].is_available)).toBe(false)

    const [category] = await rows('categories')
    expect(category).toMatchObject({ name: 'T-Shirts', slug: 't-shirts' })
    expect(tee.category_id).toBe(category.id)

    const manufacturers = await rows('manufacturers')
    expect(manufacturers).toHaveLength(1)
    expect(manufacturers[0]).toMatchObject({ manufacturer: 'Northwind Apparel', country: 'Unknown' })
    expect(products[1].manufacturer_id).toBe(manufacturers[0].id)

    // Only the product with real options gets variant rows.
    const variants = await rows('product_variants')
    expect(variants.map(variant => variant.product_id)).toEqual([tee.id, tee.id, tee.id])
    expect(variants[0]).toMatchObject({
      variant: 'S / Black',
      type: 'Size / Color',
      options: '["S","Black"]',
      status: 'active',
      sku: 'TEE-S-BLK',
      price: 2400,
      compare_at_price: 3000,
      // Shopify's public storefront API does not expose stock: untracked, not zero.
      inventory_count: null,
      // The source has no per-variant description; the column is the merchant's.
      description: null,
    })
    expect(variants[1].status).toBe('inactive')
    // A variant with no SKU at the source has none here, and its own price.
    expect(variants[2]).toMatchObject({ variant: 'L / Natural', sku: null, price: 2650, compare_at_price: null })
  })

  it('updates in place on a second run, creating nothing', async () => {
    const repository = createDatabaseRepository()
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository, now: NOW })

    // The merchant corrects a price and a title at the source...
    const changed = shopifyProducts((raw) => {
      raw[0]!.title = 'Organic Cotton Tee (2026)'
      raw[0]!.variants![0]!.price = '19.99'
      return raw
    })

    // ...and someone set a prep time on the Stacks side meanwhile.
    await (db as any).updateTable('products').set({ preparation_time: 15 }).execute()

    const second = await importCatalog({ adapter: staticAdapter('shopify', changed), storeUrl: SHOP, repository, now: NOW })

    expect(second.counts).toEqual({
      products: { created: 0, updated: 3 },
      variants: { created: 0, updated: 3 },
      categories: { created: 0, updated: 0 },
      manufacturers: { created: 0, updated: 0 },
      duplicates: 0,
    })

    const products = await rows('products')
    expect(products).toHaveLength(3)
    expect(products[0]).toMatchObject({ name: 'Organic Cotton Tee (2026)', price: 1999, preparation_time: 15 })
    const variants = await rows('product_variants')
    expect(variants).toHaveLength(3)
    expect(variants[0]).toMatchObject({ sku: 'TEE-S-BLK', price: 1999, compare_at_price: 3000 })
    expect(await rows('categories')).toHaveLength(2)
    expect(await rows('manufacturers')).toHaveLength(1)
  })

  it('reuses an existing category by slug and an existing manufacturer by name', async () => {
    await (db as any).insertInto('categories').values({ uuid: 'existing-category', name: 'Tees', slug: 't-shirts', is_active: true, display_order: 1 }).execute()
    await (db as any).insertInto('manufacturers').values({ uuid: 'existing-maker', manufacturer: 'Northwind Apparel', country: 'US', featured: false }).execute()

    const result = await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })

    expect(result.counts.categories.created).toBe(1) // only "Samples"
    expect(result.counts.manufacturers.created).toBe(0)
    const [tees] = await rows('categories')
    expect(tees.name).toBe('Tees')
    expect((await rows('products'))[0].category_id).toBe(tees.id)
  })

  it('imports the same product once when a page repeats it', async () => {
    const products = shopifyProducts()
    const result = await importCatalog({
      adapter: staticAdapter('shopify', products, [products[0]!]),
      storeUrl: SHOP,
      repository: createDatabaseRepository(),
      now: NOW,
    })

    expect(result.counts.duplicates).toBe(1)
    expect(result.warnings.map(warning => warning.message)).toContain('"Organic Cotton Tee" appeared twice; imported once')
    expect(await rows('products')).toHaveLength(3)
  })

  it('keeps two products that share a handle apart, because identity is the source id', async () => {
    const products = shopifyProducts(raw => [raw[1]!, { ...raw[1]!, id: 7612345678999 }])
    expect(products[0]!.handle).toBe(products[1]!.handle)

    await importCatalog({ adapter: staticAdapter('shopify', products), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })
    expect(await rows('products')).toHaveLength(2)
  })

  it('looks a page up in chunks, so a large catalog never trips the bind limit', async () => {
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })
    const target = catalogUuid('shopify', 'shop.example.com', 'product', '7612345678903')
    const uuids = [...Array.from({ length: 1200 }, (_, index) => `missing-${index}`), target]

    const found = await createDatabaseRepository().findProducts(uuids)
    expect([...found.keys()]).toEqual([target])
  })

  it('keeps the same product id from two stores apart', async () => {
    const repository = createDatabaseRepository()
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository, now: NOW })
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: 'https://other.example.com', repository, now: NOW })
    expect(await rows('products')).toHaveLength(6)
  })

  it('writes a WooCommerce catalog in its own currency', async () => {
    const result = await importCatalog({ adapter: staticAdapter('woocommerce', wooCatalog()), storeUrl: WOO, repository: createDatabaseRepository(), now: NOW })

    expect(result.currencies).toEqual(['GBP'])
    const products = await rows('products')
    expect(products.map(product => [product.name, product.price, product.inventory_count])).toEqual([
      [`Hoodie & Logo ${String.fromCodePoint(0x2013)} Navy`, 3500, 3],
      ['V-Neck T-Shirt', 1500, 0],
      ['Logo Collection', 0, 0],
    ])
    const variants = await rows('product_variants')
    expect(variants.map(variant => [variant.variant, variant.sku, variant.price, variant.compare_at_price, variant.inventory_count, variant.description])).toEqual([
      ['Blue / Large', 'woo-vneck-tee-blue-l', 2000, null, 2, null],
      ['Green / Any', 'woo-vneck-tee-green', 1500, 1800, null, null],
    ])
    expect((await rows('manufacturers'))[0].manufacturer).toBe('Thread & Needle')
  })

  it('keeps the merchant\'s variant stock, SKU and description when the source reports none', async () => {
    const repository = createDatabaseRepository()
    await importCatalog({ adapter: staticAdapter('woocommerce', wooCatalog()), storeUrl: WOO, repository, now: NOW })

    // The merchant starts tracking stock on the untracked variant, gives the
    // tracked one a description, and the source stops reporting both SKUs.
    const [blue, green] = await rows('product_variants')
    await (db as any).updateTable('product_variants').set({ inventory_count: 12 }).where('id', '=', green.id).execute()
    await (db as any).updateTable('product_variants').set({ description: 'Runs small' }).where('id', '=', blue.id).execute()

    const catalog = wooCatalog()
    for (const variant of catalog[1]!.variants) {
      variant.sku = null
      variant.inventory = null
    }
    await importCatalog({ adapter: staticAdapter('woocommerce', catalog), storeUrl: WOO, repository, now: NOW })

    const [blueAfter, greenAfter] = await rows('product_variants')
    expect(greenAfter).toMatchObject({ inventory_count: 12, sku: 'woo-vneck-tee-green', price: 1500 })
    expect(blueAfter).toMatchObject({ inventory_count: 2, sku: 'woo-vneck-tee-blue-l', description: 'Runs small' })
  })

  it('moves a SKU between variants on a re-run without tripping the per-product unique index', async () => {
    const repository = createDatabaseRepository()
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository, now: NOW })

    // The merchant swaps two SKUs at the source. Written in order, the first
    // variant would claim a SKU the second still holds.
    const swapped = shopifyProducts((raw) => {
      raw[0]!.variants![0]!.sku = 'TEE-M-BLK'
      raw[0]!.variants![1]!.sku = 'TEE-S-BLK'
      return raw
    })
    const result = await importCatalog({ adapter: staticAdapter('shopify', swapped), storeUrl: SHOP, repository, now: NOW })

    expect(result.counts.variants).toEqual({ created: 0, updated: 3 })
    expect((await rows('product_variants')).map(variant => [variant.variant, variant.sku])).toEqual([
      ['S / Black', 'TEE-M-BLK'],
      ['M / Black', 'TEE-S-BLK'],
      ['L / Natural', null],
    ])
  })

  it('imports a product whose variants repeat a SKU, keeping it on the first', async () => {
    const products = shopifyProducts((raw) => {
      raw[0]!.variants![1]!.sku = 'TEE-S-BLK'
      return raw
    })
    const result = await importCatalog({ adapter: staticAdapter('shopify', products), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })

    expect(result.counts.variants.created).toBe(3)
    expect(result.warnings.map(warning => warning.message)).toContain('"Organic Cotton Tee" variant "M / Black" repeats SKU TEE-S-BLK; imported without it')
    expect((await rows('product_variants')).map(variant => variant.sku)).toEqual(['TEE-S-BLK', null, null])
  })

  it('enforces one SKU per product, but lets two products share one', async () => {
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository: createDatabaseRepository(), now: NOW })
    const [first] = await rows('product_variants')

    const insert = (productId: number) => (db as any).insertInto('product_variants').values({
      uuid: `manual-${productId}`,
      product_id: productId,
      variant: 'Copy',
      type: 'Size',
      status: 'active',
      sku: 'TEE-S-BLK',
    }).execute()

    await expect(insert(first.product_id)).rejects.toThrow()
    await insert(first.product_id + 1)
    expect((await rows('product_variants')).filter(variant => variant.sku === 'TEE-S-BLK')).toHaveLength(2)
  })

  it('writes nothing on a dry run, and reports what a real run would do', async () => {
    const repository = createDatabaseRepository()
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts().slice(0, 1)), storeUrl: SHOP, repository, now: NOW })

    const dry = await importCatalog({
      adapter: staticAdapter('shopify', shopifyProducts()),
      storeUrl: SHOP,
      repository: createReadOnlyRepository(repository),
      dryRun: true,
      now: NOW,
    })

    expect(dry.dryRun).toBe(true)
    expect(dry.products.map(product => product.action)).toEqual(['update', 'create', 'create'])
    expect(dry.counts.categories.created).toBe(1)
    expect(await rows('products')).toHaveLength(1)
    expect(await rows('categories')).toHaveLength(1)
  })
})

describe('the writer, without a database', () => {
  it('is idempotent against the in-memory repository too', async () => {
    const repository = createMemoryRepository()
    await importCatalog({ adapter: staticAdapter('woocommerce', wooCatalog()), storeUrl: WOO, repository, now: NOW })
    const again = await importCatalog({ adapter: staticAdapter('woocommerce', wooCatalog()), storeUrl: WOO, repository, now: NOW })

    expect(again.counts.products).toEqual({ created: 0, updated: 3 })
    expect(repository.tables.products).toHaveLength(3)
    expect(repository.tables.categories!.map(category => category.slug)).toEqual(['hoodies-sweatshirts', 'tshirts', 'clothing'])
  })

  it('warns when a catalog mixes currencies', async () => {
    const products = [...shopifyProducts(), ...wooCatalog()]
    const result = await importCatalog({ adapter: staticAdapter('shopify', products), storeUrl: SHOP, repository: createMemoryRepository(), now: NOW })
    expect(result.warnings.at(-1)!.message).toContain('more than one currency (GBP, USD)')
  })

  it('does not overwrite operator-owned columns on update', () => {
    const [tee] = shopifyProducts()
    const row = productRow(tee!, 'shop.example.com', { categoryId: null, manufacturerId: null }, '2026-10-02 12:00:00', 'update')
    expect(row).not.toHaveProperty('preparation_time')
    expect(row).not.toHaveProperty('inventory_count')
    expect(row).not.toHaveProperty('category_id')
    expect(row).not.toHaveProperty('created_at')
  })

  it('writes an unpriced variant as inheriting the product price, not free', () => {
    const [tee] = shopifyProducts()
    const variant = { externalId: '1', title: 'x', sku: null, priceMinor: null, compareAtMinor: null, available: true, inventory: null, optionValues: [] }
    const row = variantRow(tee!, variant, 'shop.example.com', 1, '2026-10-02 12:00:00', 'create')
    expect(row).toMatchObject({ price: null, compare_at_price: null, sku: null, inventory_count: null })
    expect(row).not.toHaveProperty('description')
  })

  it('does not overwrite a variant\'s SKU or stock on update when the source reports none', () => {
    const [tee] = shopifyProducts()
    const variant = { ...tee!.variants[0]!, sku: null, inventory: null }
    const row = variantRow(tee!, variant, 'shop.example.com', 1, '2026-10-02 12:00:00', 'update')
    expect(row).not.toHaveProperty('sku')
    expect(row).not.toHaveProperty('inventory_count')
    expect(row).not.toHaveProperty('description')
    expect(row).not.toHaveProperty('created_at')
    // Pricing is the source's, so it is always written.
    expect(row).toMatchObject({ price: 2400, compare_at_price: 3000 })
  })

  it('drops a SKU too long for the column, with a warning', () => {
    const [tee] = shopifyProducts()
    tee!.variants[0]!.sku = 'X'.repeat(SKU_MAX + 1)
    const { skus, warnings } = variantSkus(tee!)
    expect(skus.get(tee!.variants[0]!.externalId)).toBeNull()
    expect(skus.get(tee!.variants[1]!.externalId)).toBe('TEE-M-BLK')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.message).toContain(`longer than ${SKU_MAX} characters`)
  })

  it('releases a SKU in the in-memory repository the same way', async () => {
    const repository = createMemoryRepository()
    await importCatalog({ adapter: staticAdapter('shopify', shopifyProducts()), storeUrl: SHOP, repository, now: NOW })
    const swapped = shopifyProducts((raw) => {
      raw[0]!.variants![0]!.sku = 'TEE-M-BLK'
      raw[0]!.variants![1]!.sku = 'TEE-S-BLK'
      return raw
    })
    await importCatalog({ adapter: staticAdapter('shopify', swapped), storeUrl: SHOP, repository, now: NOW })
    expect(repository.tables.product_variants!.map(variant => variant.sku)).toEqual(['TEE-M-BLK', 'TEE-S-BLK', null])
  })
})
