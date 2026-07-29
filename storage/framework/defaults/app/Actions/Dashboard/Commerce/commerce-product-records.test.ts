import { describe, expect, test } from 'bun:test'
import {
  countProductRelations,
  normalizeCommerceProductRecord,
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
    expect(normalizeProductVariantDetail({ id: 1, variant: 'Blue', options: '["Navy"]' }).options).toEqual(['Navy'])
    expect(normalizeProductUnitDetail({ id: 1, is_default: 1 }).isDefault).toBeTrue()
    expect(normalizeManufacturerOption({ id: 3, manufacturer: 'Stacks Labs' })).toEqual({ id: '3', label: 'Stacks Labs' })
    expect(summarizeProductReviews([{ rating: 5, is_approved: 1 }, { rating: 3, is_approved: 0 }])).toEqual({
      total: 2,
      approved: 1,
      pending: 1,
      averageRating: 4,
    })

    const records = [
      normalizeCommerceProductRecord({ id: 1, isAvailable: true, inventoryCount: 3 }, new Map(), new Map(), new Map(), new Map(), new Map()),
      normalizeCommerceProductRecord({ id: 2, isAvailable: false, inventoryCount: 0 }, new Map(), new Map(), new Map(), new Map(), new Map()),
    ]
    expect(summarizeCommerceProducts(records)).toEqual({
      total: 2,
      available: 1,
      unavailable: 1,
      outOfStock: 1,
      totalInventory: 3,
    })
  })
})
