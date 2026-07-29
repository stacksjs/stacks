import { describe, expect, it } from 'bun:test'
import {
  normalizeProductVariantRecord,
  parseVariantOptions,
  summarizeProductVariants,
} from './product-variant-records'

describe('dashboard product variant records', () => {
  it('parses persisted JSON and legacy comma options', () => {
    expect(parseVariantOptions('["Small","Large"]')).toEqual(['Small', 'Large'])
    expect(parseVariantOptions('Red, Blue')).toEqual(['Red', 'Blue'])
    expect(parseVariantOptions('{"invalid":true}')).toEqual([])
  })

  it('normalizes model columns and product relationships', () => {
    expect(normalizeProductVariantRecord({
      id: 8,
      variant: 'Large',
      type: 'size',
      description: 'Large configuration',
      options: '["Large","XL"]',
      status: 'draft',
      product_id: 3,
      created_at: '2026-07-29 10:00:00',
    }, new Map([['3', 'Coffee']])))
      .toEqual({
        id: '8',
        variant: 'Large',
        type: 'size',
        description: 'Large configuration',
        options: ['Large', 'XL'],
        status: 'draft',
        productId: '3',
        productName: 'Coffee',
        createdAt: '2026-07-29 10:00:00',
      })
  })

  it('summarizes persisted variant states', () => {
    const records = [
      normalizeProductVariantRecord({ id: 1, status: 'active', product_id: 2 }),
      normalizeProductVariantRecord({ id: 2, status: 'draft', product_id: 2 }),
      normalizeProductVariantRecord({ id: 3, status: 'inactive', product_id: 4 }),
    ]
    expect(summarizeProductVariants(records)).toEqual({
      total: 3,
      active: 1,
      draft: 1,
      linkedProducts: 2,
    })
  })
})
