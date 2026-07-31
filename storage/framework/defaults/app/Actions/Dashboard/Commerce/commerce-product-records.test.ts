import { describe, expect, test } from 'bun:test'
import {
  countProductRelations,
  normalizeCommerceProductRecord,
  normalizeCommerceCurrency,
  normalizeManufacturerOption,
  normalizeProductUnitDetail,
  normalizeProductVariantDetail,
  summarizeCommerceProducts,
  summarizeProductReviews,
} from './commerce-product-records'

describe('dashboard commerce product records', () => {
  test('normalizes persisted product fields and relationships', () => {
    const record = normalizeCommerceProductRecord({
      id: 5,
      name: 'Native Kit',
      price: 125,
      is_available: 1,
      inventory_count: 7,
      preparation_time: 3,
      category_id: 2,
      manufacturer_id: 4,
      allergens: '["Soy","Nuts"]',
      nutritional_info: '{"calories":120,"vegan":true}',
      created_at: '2026-07-29 12:00:00',
    }, new Map([['2', 'Hardware']]), new Map([['4', 'Stacks Labs']]), new Map([['5', 2]]), new Map([['5', 1]]), new Map([['5', 3]]))

    expect(record).toMatchObject({
      id: '5',
      name: 'Native Kit',
      price: 125,
      isAvailable: true,
      inventoryCount: 7,
      categoryName: 'Hardware',
      manufacturerName: 'Stacks Labs',
      allergens: ['Soy', 'Nuts'],
      nutritionalInfo: { calories: '120', vegan: 'true' },
      variantCount: 2,
      unitCount: 1,
      reviewCount: 3,
    })
  })

  test('summarizes inventory and related native records', () => {
    const counts = countProductRelations([{ product_id: 1 }, { productId: 1 }, { product_id: 2 }])
    expect([...counts.entries()]).toEqual([['1', 2], ['2', 1]])
    expect(normalizeProductVariantDetail({
      id: 1,
      variant: 'Blue',
      type: 'color',
      options: '["Navy"]',
      status: 'active',
    }).options).toEqual(['Navy'])
    expect(normalizeProductUnitDetail({
      id: 1,
      name: 'Piece',
      abbreviation: 'pc',
      type: 'Quantity',
      is_default: 1,
    }).isDefault).toBeTrue()
    expect(normalizeManufacturerOption({ id: 3, manufacturer: 'Stacks Labs' })).toEqual({ id: '3', label: 'Stacks Labs' })
    expect(normalizeCommerceCurrency('usd')).toBe('USD')
    expect(summarizeProductReviews([{ rating: 5, is_approved: 1 }, { rating: 3, is_approved: 0 }])).toEqual({
      total: 2,
      approved: 1,
      pending: 1,
      averageRating: 4,
    })

    const records = [
      normalizeCommerceProductRecord({
        id: 1,
        name: 'Available',
        price: 100,
        isAvailable: true,
        inventoryCount: 3,
        preparationTime: 1,
        createdAt: '2026-07-29 12:00:00',
      }, new Map(), new Map(), new Map(), new Map(), new Map()),
      normalizeCommerceProductRecord({
        id: 2,
        name: 'Unavailable',
        price: 100,
        isAvailable: false,
        inventoryCount: 0,
        preparationTime: 1,
        createdAt: '2026-07-29 12:00:00',
      }, new Map(), new Map(), new Map(), new Map(), new Map()),
    ]
    expect(summarizeCommerceProducts(records)).toEqual({
      total: 2,
      available: 1,
      unavailable: 1,
      outOfStock: 1,
      totalInventory: 3,
    })
  })

  test('rejects corrupt stored values and missing relations', () => {
    const base = {
      id: 1,
      name: 'Native Kit',
      price: 125,
      is_available: 1,
      inventory_count: 7,
      preparation_time: 3,
      created_at: '2026-07-29 12:00:00',
    }

    expect(() => normalizeCommerceProductRecord(
      { ...base, price: 'free' },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    )).toThrow('Product 1.price must be a finite number')
    expect(() => normalizeCommerceProductRecord(
      { ...base, allergens: '["Soy"' },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    )).toThrow('valid JSON')
    expect(() => normalizeCommerceProductRecord(
      { ...base, category_id: 99 },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    )).toThrow('references missing Category 99')
    expect(() => summarizeProductReviews([{ rating: 'unknown', is_approved: 1 }]))
      .toThrow('Review 1.rating must be a finite number')
    expect(() => normalizeCommerceCurrency('US')).toThrow('three-letter currency code')
  })
})
