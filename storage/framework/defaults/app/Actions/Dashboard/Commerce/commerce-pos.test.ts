import { describe, expect, it } from 'bun:test'
import {
  calculateCommercePosSale,
  deriveCommercePosTaxRate,
  isCommercePosCustomerActive,
  normalizeCommercePosCustomer,
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
      { id: 1, status: 'active', is_default: 0, rate: 5 },
      { id: 2, status: 'active', is_default: 1, rate: 7.5 },
      { id: 3, status: 'inactive', is_default: 1, rate: 99 },
    ]
    expect(selectCommercePosTaxRate(rows)).toBe(7.5)
  })

  it('reconstructs persisted receipt tax rates', () => {
    expect(deriveCommercePosTaxRate(3138, 1255.2)).toBe(40)
    expect(deriveCommercePosTaxRate(0, 0)).toBe(0)
    expect(() => deriveCommercePosTaxRate(0, 10)).toThrow('cannot contain tax')
    expect(() => deriveCommercePosTaxRate(100, -1)).toThrow('non-negative')
  })

  it('validates persisted customers and tax rates', () => {
    const customer = { id: 1, name: 'Chris', email: 'chris@example.com', status: 'Active' }
    expect(isCommercePosCustomerActive(customer)).toBeTrue()
    expect(normalizeCommercePosCustomer(customer)).toEqual({
      id: '1',
      label: 'Chris',
      email: 'chris@example.com',
    })
    expect(() => normalizeCommercePosCustomer({ id: 1, name: '', email: '' }))
      .toThrow('Customer 1.name must be a non-empty string')
    expect(() => selectCommercePosTaxRate([{ id: 1, status: 'active', is_default: false, rate: 'invalid' }]))
      .toThrow('TaxRate 1.rate must be a finite number')
  })

  it('refuses quantities above persisted inventory', () => {
    expect(() => calculateCommercePosSale([
      {
        id: '4',
        name: 'Widget',
        description: '',
        price: 12.5,
        isAvailable: true,
        inventoryCount: 2,
        preparationTime: 4,
        allergens: [],
        categoryId: '',
        categoryName: 'Unassigned category',
      },
    ], [{ productId: 4, quantity: 3, specialInstructions: '' }], 0))
      .toThrow('has only 2 available')
  })
})
