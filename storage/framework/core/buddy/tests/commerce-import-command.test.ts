import { describe, expect, it } from 'bun:test'
import {
  currencyMismatch,
  formatImportedProduct,
  formatImportSummary,
  OUT_OF_SCOPE_NOTE,
  parseImportFlags,
} from '../src/commands/commerce-import'
import { getCommandNames, getCommandsToLoad } from '../src/lazy-commands'

/**
 * `buddy commerce:import`: the flag contract and what the operator reads.
 *
 * The importing itself (mapping, paging, idempotent writes) is tested where it
 * lives, in core/commerce/src/tests/catalog-import-*.test.ts. This covers the
 * shell around it.
 */

const format = (minor: number, currency: string | null) => `${(minor / 100).toFixed(2)}${currency ? ` ${currency}` : ''}`

function result(overrides: Record<string, unknown> = {}): any {
  return {
    source: 'shopify',
    storeUrl: 'https://shop.example.com',
    dryRun: false,
    pages: [],
    products: [],
    counts: {
      products: { created: 2, updated: 1 },
      variants: { created: 3, updated: 0 },
      categories: { created: 1, updated: 0 },
      manufacturers: { created: 1, updated: 0 },
      duplicates: 0,
    },
    currencies: ['USD'],
    warnings: [],
    ...overrides,
  }
}

describe('parseImportFlags', () => {
  it('accepts each supported platform, case-insensitively', () => {
    expect(parseImportFlags({ from: 'Shopify' })).toEqual({ source: 'shopify', limit: undefined, currency: undefined, dryRun: false })
    expect(parseImportFlags({ from: 'woocommerce', limit: '25', currency: 'gbp', dryRun: true }))
      .toEqual({ source: 'woocommerce', limit: 25, currency: 'GBP', dryRun: true })
  })

  it('requires --from rather than guessing the platform', () => {
    expect(() => parseImportFlags({})).toThrow('--from shopify or --from woocommerce')
    expect(() => parseImportFlags({ from: 'shopware' })).toThrow('--from must be one of shopify, woocommerce; got "shopware"')
  })

  it.each(['0', '-3', '2.5', 'ten'])('rejects --limit %p', (limit) => {
    expect(() => parseImportFlags({ from: 'shopify', limit })).toThrow('--limit must be a whole number above 0')
  })

  it('rejects a currency that is not an ISO code', () => {
    expect(() => parseImportFlags({ from: 'shopify', currency: 'dollars' })).toThrow('--currency must be a three-letter ISO 4217 code')
  })
})

describe('import output', () => {
  const product = {
    action: 'create' as const,
    externalId: '1',
    name: 'Organic Cotton Tee',
    handle: 'organic-cotton-tee',
    priceMinor: 2400,
    currency: 'USD',
    variants: { create: 3, update: 0 },
    category: 'T-Shirts',
    vendor: 'Northwind Apparel',
    imageCount: 0,
  }

  it('says what happened to each product, and what a dry run would do', () => {
    expect(formatImportedProduct(product, format)).toBe('  created      Organic Cotton Tee (organic-cotton-tee)  24.00 USD, 3 variants, in T-Shirts, by Northwind Apparel, no image')
    expect(formatImportedProduct({ ...product, action: 'update' }, format, true)).toContain('would update')
    expect(formatImportedProduct({ ...product, priceMinor: null, variants: { create: 0, update: 0 }, category: null, vendor: null, imageCount: 1 }, format))
      .toBe('  created      Organic Cotton Tee (organic-cotton-tee)  unpriced')
  })

  it('summarizes counts, and words a dry run as a forecast', () => {
    expect(formatImportSummary(result())).toEqual([
      'Products: 2 created, 1 updated',
      'Variants: 3 created, 0 updated',
      'Categories: 1 created. Manufacturers: 1 created',
      'Currency: USD',
    ])
    expect(formatImportSummary(result({ dryRun: true, currencies: [] }))[0]).toBe('Products: 2 would be created, 1 would be updated')
    expect(formatImportSummary(result({ currencies: [] })).at(-1)).toBe('Currency: not reported by the store')
  })

  it('flags a catalog priced in a different currency from the app', () => {
    expect(currencyMismatch(result({ currencies: ['GBP'] }), 'USD')).toContain('imported in GBP minor units, but config/commerce.ts sets currency to USD')
    expect(currencyMismatch(result(), 'usd')).toBeNull()
    expect(currencyMismatch(result(), undefined)).toBeNull()
  })

  it('tells the operator customers and orders were not imported', () => {
    expect(OUT_OF_SCOPE_NOTE).toContain('Customers and orders are not imported')
  })
})

describe('registration', () => {
  it('loads its own module, not the commerce:install one', () => {
    expect(getCommandNames()).toContain('commerce:import')
    expect(getCommandsToLoad(['commerce:import', 'https://shop.example.com'])).toEqual(['commerce:import'])
  })
})
