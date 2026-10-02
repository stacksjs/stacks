import type { ShopifyProductPayload, WooProductPayload } from '../imports'
import { describe, expect, it } from 'bun:test'
import { mapShopifyProduct, mapWooProduct } from '../imports'
import shopifyFixture from './fixtures/catalog-import/shopify-products.json'
import wooProducts from './fixtures/catalog-import/woocommerce-products.json'
import wooVariations from './fixtures/catalog-import/woocommerce-variations.json'

/**
 * Source payload to normalized catalog record, from recorded responses.
 *
 * The fixtures are trimmed copies of what `products.json` and the Store API
 * return, so a field that moves on either platform shows up here first.
 */

const shopify = shopifyFixture.products as unknown as ShopifyProductPayload[]
const woo = wooProducts as unknown as WooProductPayload[]
const variations = new Map((wooVariations as unknown as WooProductPayload[]).map(variation => [String(variation.id), variation]))

const context = { storeUrl: 'https://shop.example.com', currency: 'USD' }

describe('mapShopifyProduct', () => {
  it('maps a product with real options', () => {
    const { product, warnings } = mapShopifyProduct(shopify[0]!, context)

    expect(warnings).toEqual([])
    expect(product).toMatchObject({
      source: 'shopify',
      externalId: '7612345678901',
      name: 'Organic Cotton Tee',
      handle: 'organic-cotton-tee',
      descriptionHtml: '<p>Soft, breathable and <strong>100% organic</strong> cotton.</p>',
      vendor: 'Northwind Apparel',
      categories: [{ name: 'T-Shirts', slug: 't-shirts' }],
      tags: ['cotton', 'organic', 'summer'],
      currency: 'USD',
      optionNames: ['Size', 'Color'],
      hasOptions: true,
      url: 'https://shop.example.com/products/organic-cotton-tee',
    })
  })

  it('reads variant prices as integer cents, with compare-at and availability', () => {
    const { product } = mapShopifyProduct(shopify[0]!, context)

    expect(product.variants).toEqual([
      { externalId: '42811111111101', title: 'S / Black', sku: 'TEE-S-BLK', priceMinor: 2400, compareAtMinor: 3000, available: true, inventory: null, optionValues: ['S', 'Black'] },
      { externalId: '42811111111102', title: 'M / Black', sku: 'TEE-M-BLK', priceMinor: 2400, compareAtMinor: null, available: false, inventory: null, optionValues: ['M', 'Black'] },
      // "26.5" is $26.50, and an empty SKU is no SKU.
      { externalId: '42811111111103', title: 'L / Natural', sku: null, priceMinor: 2650, compareAtMinor: null, available: true, inventory: null, optionValues: ['L', 'Natural'] },
    ])
  })

  it('orders images by position and keeps the CDN URL', () => {
    const { product } = mapShopifyProduct(shopify[0]!, context)
    expect(product.images.map(image => image.src)).toEqual([
      'https://cdn.shopify.com/s/files/1/0000/0001/products/tee-front.jpg?v=1709565162',
      'https://cdn.shopify.com/s/files/1/0000/0001/products/tee-back.jpg?v=1709565162',
    ])
  })

  it('treats the Default Title variant as a product without options', () => {
    const { product } = mapShopifyProduct(shopify[1]!, context)

    expect(product.hasOptions).toBe(false)
    expect(product.optionNames).toEqual([])
    expect(product.categories).toEqual([])
    expect(product.images).toEqual([])
    expect(product.descriptionHtml).toBeNull()
    // "0.10" is ten cents; "0.00" compare-at means none.
    expect(product.variants).toEqual([
      { externalId: '42811111111201', title: 'Default Title', sku: 'SLEEVE-1', priceMinor: 10, compareAtMinor: null, available: true, inventory: null, optionValues: [] },
    ])
  })

  it('maps a product without variants and says so', () => {
    const { product, warnings } = mapShopifyProduct(shopify[2]!, context)

    expect(product.variants).toEqual([])
    expect(product.vendor).toBeNull()
    expect(product.categories).toEqual([{ name: 'Samples', slug: 'samples' }])
    expect(warnings).toEqual([{ externalId: '7612345678903', message: '"Archived Sample" has no variants; imported without a price' }])
  })

  it('leaves an unreadable price unpriced with a warning instead of guessing', () => {
    const raw = { ...shopify[1]!, variants: [{ ...shopify[1]!.variants![0]!, price: '1,000.00' }] }
    const { product, warnings } = mapShopifyProduct(raw, context)

    expect(product.variants[0]!.priceMinor).toBeNull()
    expect(warnings[0]!.message).toContain('"1,000.00"')
  })

  it('converts at the shop currency precision', () => {
    const raw = { ...shopify[1]!, variants: [{ ...shopify[1]!.variants![0]!, price: '1999.00' }] }
    expect(mapShopifyProduct(raw, { ...context, currency: 'JPY' }).product.variants[0]!.priceMinor).toBe(1999)
  })

  it('falls back to a slug of the title when the handle is missing, and rejects a nameless product', () => {
    expect(mapShopifyProduct({ id: 5, title: 'Big & Tall Coat', variants: [] }, context).product.handle).toBe('big-and-tall-coat')
    expect(() => mapShopifyProduct({ id: 6, title: '  ' }, context)).toThrow('has no title')
    expect(() => mapShopifyProduct({ title: 'No id' } as ShopifyProductPayload, context)).toThrow('has no id')
  })

  it('accepts tags as the comma string the Admin API uses', () => {
    expect(mapShopifyProduct({ ...shopify[1]!, tags: 'a, b ,,c' }, context).product.tags).toEqual(['a', 'b', 'c'])
  })
})

describe('mapWooProduct', () => {
  it('decodes HTML entities in names, categories and brands, but not the description', () => {
    const { product } = mapWooProduct(woo[0]!)

    expect(product.name).toBe(`Hoodie & Logo ${String.fromCodePoint(0x2013)} Navy`)
    expect(product.categories[0]).toEqual({ name: 'Hoodies & Sweatshirts', slug: 'hoodies-sweatshirts' })
    expect(product.vendor).toBe('Thread & Needle')
    expect(product.descriptionHtml).toBe('<p>A heavyweight hoodie &amp; a stitched logo.</p>')
  })

  it('maps a simple product as its own single variant, with sale and low stock', () => {
    const { product, warnings } = mapWooProduct(woo[0]!)

    expect(warnings).toEqual([])
    expect(product).toMatchObject({
      source: 'woocommerce',
      externalId: '81',
      handle: 'hoodie-with-logo-navy',
      currency: 'GBP',
      tags: ['Winter'],
      hasOptions: false,
      optionNames: [],
      url: 'https://shop.example.co.uk/product/hoodie-with-logo-navy/',
      images: [{ src: 'https://shop.example.co.uk/wp-content/uploads/2026/02/hoodie-navy.jpg', alt: 'Navy hoodie, front' }],
    })
    expect(product.variants).toEqual([
      { externalId: '81', title: product.name, sku: 'woo-hoodie-logo', priceMinor: 3500, compareAtMinor: 4500, available: true, inventory: 3, optionValues: [] },
    ])
  })

  it('maps a variable product with its fetched variations', () => {
    const { product, warnings } = mapWooProduct(woo[1]!, { variations })

    expect(warnings).toEqual([])
    expect(product.hasOptions).toBe(true)
    expect(product.optionNames).toEqual(['Color', 'Size'])
    // Short description stands in for an empty long one.
    expect(product.descriptionHtml).toBe('<p>Pizza-free since 2014.</p>')
    expect(product.variants).toEqual([
      // Term slugs come back as term names.
      { externalId: '91', title: 'Blue / Large', sku: 'woo-vneck-tee-blue-l', priceMinor: 2000, compareAtMinor: null, available: true, inventory: 2, optionValues: ['Blue', 'Large'] },
      // An empty attribute value is WooCommerce for "any size".
      { externalId: '92', title: 'Green / Any', sku: 'woo-vneck-tee-green', priceMinor: 1500, compareAtMinor: 1800, available: false, inventory: null, optionValues: ['Green', 'Any'] },
    ])
  })

  it('keeps variations it could not fetch, unpriced, and says so', () => {
    const { product, warnings } = mapWooProduct(woo[1]!)

    expect(product.variants.map(variant => variant.priceMinor)).toEqual([null, null])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]!.message).toContain('variation 91 could not be fetched')
  })

  it('leaves a product with no price unpriced rather than free', () => {
    const { product } = mapWooProduct(woo[2]!)
    expect(product.variants[0]!.priceMinor).toBeNull()
    expect(product.variants[0]!.available).toBe(false)
    expect(product.images).toEqual([])
  })

  it('normalizes the store precision to the currency precision', () => {
    const zeroDecimalStore = { ...woo[0]!, prices: { price: '35', regular_price: '35', currency_code: 'USD', currency_minor_unit: 0 } }
    expect(mapWooProduct(zeroDecimalStore).product.variants[0]!.priceMinor).toBe(3500)

    const yen = { ...woo[0]!, prices: { price: '1999', regular_price: '1999', currency_code: 'JPY', currency_minor_unit: 0 } }
    expect(mapWooProduct(yen).product.variants[0]!.priceMinor).toBe(1999)
  })

  it('rejects a product without a name', () => {
    expect(() => mapWooProduct({ id: 1, name: ' ' })).toThrow('has no name')
  })
})
