import { describe, expect, it } from 'bun:test'
import {
  normalizeProductVariantRecord,
  parseVariantOptions,
  productVariantOptions,
  summarizeProductVariants,
} from './product-variant-records'

function variant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 8,
    variant: 'Large',
    type: 'size',
    description: null,
    options: null,
    status: 'active',
    product_id: null,
    created_at: '2026-07-29 10:00:00',
    ...overrides,
  }
}

describe('dashboard product variant records', () => {
  it('parses persisted JSON and declared legacy comma options', () => {
    expect(parseVariantOptions('["Small","Large"]')).toEqual(['Small', 'Large'])
    expect(parseVariantOptions('Red, Blue')).toEqual(['Red', 'Blue'])
    expect(() => parseVariantOptions('{"invalid":true}')).toThrow('JSON array')
  })

  it('normalizes model columns and Product relationships', () => {
    expect(normalizeProductVariantRecord(variant({
      description: 'Large configuration',
      options: '["Large","XL"]',
      status: 'draft',
      product_id: 3,
    }), new Map([['3', 'Coffee']])))
      .toEqual({
        id: '8',
        variant: 'Large',
        type: 'size',
        description: 'Large configuration',
        options: ['Large', 'XL'],
        status: 'draft',
        productId: '3',
        productName: 'Coffee',
        createdAt: '2026-07-29T10:00:00.000Z',
      })
  })

  it('rejects malformed state and missing Product relationships', () => {
    expect(() => normalizeProductVariantRecord(variant({
      status: 'legacy',
    }))).toThrow('ProductVariant 8.status must be active or inactive or draft')
    expect(() => normalizeProductVariantRecord(variant({
      product_id: 9,
    }), new Map())).toThrow('ProductVariant 8.product_id references missing Product 9')
  })

  it('summarizes persisted variant states', () => {
    const productNames = new Map([['2', 'Coffee'], ['4', 'Tea']])
    const records = [
      normalizeProductVariantRecord(variant({ id: 1, status: 'active', product_id: 2 }), productNames),
      normalizeProductVariantRecord(variant({ id: 2, status: 'draft', product_id: 2 }), productNames),
      normalizeProductVariantRecord(variant({ id: 3, status: 'inactive', product_id: 4 }), productNames),
    ]
    expect(summarizeProductVariants(records)).toEqual({
      total: 3,
      active: 1,
      draft: 1,
      linkedProducts: 2,
    })
  })

  it('builds validated Product options', () => {
    expect(productVariantOptions([
      { id: 2, name: 'Tea' },
      { id: 1, name: 'Coffee' },
    ])).toEqual([
      { id: '1', name: 'Coffee' },
      { id: '2', name: 'Tea' },
    ])
    expect(() => productVariantOptions([{ id: 3, name: '' }]))
      .toThrow('Product 3.name must be a non-empty string')
  })
})
