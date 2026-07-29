import { describe, expect, it } from 'bun:test'
import {
  calculateCommercePosSale,
  deriveCommercePosTaxRate,
  parseCommercePosLines,
  selectCommercePosTaxRate,
} from './commerce-pos'

describe('dashboard commerce POS helpers', () => {
  it('merges duplicate checkout lines and preserves instructions', () => {
    expect(parseCommercePosLines([
      { productId: 7, quantity: 2, specialInstructions: 'Gift wrap' },
      { productId: 7, quantity: 1 },
    ])).toEqual({
      lines: [{ productId: 7, quantity: 3, specialInstructions: 'Gift wrap' }],
      error: '',
    })
  })

  it('rejects invalid quantities before any write occurs', () => {
    const result = parseCommercePosLines([{ productId: 4, quantity: 0 }])
    expect(result.lines).toEqual([])
    expect(result.error).toContain('between 1 and 999')
  })

  it('recomputes server-authoritative totals from persisted prices', () => {
    const sale = calculateCommercePosSale([
      {
        id: '4',
        name: 'Widget',
        description: '',
        price: 12.5,
        isAvailable: true,
        inventoryCount: 20,
        preparationTime: 4,
        allergens: [],
        categoryId: '',
        categoryName: 'Unassigned category',
      },
    ], [{ productId: 4, quantity: 3, specialInstructions: '' }], 8.25)
    expect(sale.subtotal).toBe(37.5)
    expect(sale.taxAmount).toBe(3.09)
    expect(sale.totalAmount).toBe(40.59)
  })

  it('chooses an active default tax rate', () => {
    const rows = [
      { status: 'active', is_default: 0, rate: 5 },
      { status: 'active', is_default: 1, rate: 7.5 },
      { status: 'inactive', is_default: 1, rate: 99 },
    ]
    expect(selectCommercePosTaxRate(rows)).toBe(7.5)
  })

  it('reconstructs persisted receipt tax rates', () => {
    expect(deriveCommercePosTaxRate(3138, 1255.2)).toBe(40)
    expect(deriveCommercePosTaxRate(0, 10)).toBe(0)
    expect(deriveCommercePosTaxRate(100, -1)).toBe(0)
  })
})
