import { expect, test } from 'bun:test'
import { restockedQuantity } from '../inventory'
import { parseSalesTaxSetup, parseTaxRateWriteData } from '../tax-input'

test('inventory additions preserve counted stock and bounds', () => {
  expect(restockedQuantity('10', 7, 20)).toBe(17)
  for (const current of [null, undefined, true, {}, -1]) expect(() => restockedQuantity(current, 1)).toThrow()
  expect(() => restockedQuantity(19, 2, 20)).toThrow()
  expect(() => restockedQuantity(10, 0)).toThrow()
})
test('tax configuration requires explicit rates and distinct normalized codes', () => {
  expect(parseSalesTaxSetup({ rates: [] }).rates).toEqual([])
  for (const body of [null, {}, { rates: {} }, { rates: [{ name: 'Local', rate: true }] }, { rates: [{ name: 'A', code: 'local tax', rate: 2 }, { name: 'B', code: 'local-tax', rate: 3 }] }]) expect(() => parseSalesTaxSetup(body)).toThrow()
  expect(parseSalesTaxSetup({ rates: [{ name: 'Local', rate: '7.5' }] }).rates[0]!.rate).toBe(7.5)
  expect(() => parseSalesTaxSetup({ rates: [{ name: 'Local', rate: 31 }] }, { maxRate: 30 })).toThrow()
})
test('native tax writes normalize form booleans without treating false text as consent', () => {
  expect(parseTaxRateWriteData({ is_default: 'false' as unknown as boolean, exemptible: 0 as unknown as boolean })).toEqual({ is_default: false, exemptible: false })
  expect(() => parseTaxRateWriteData({ rate: true as unknown as number })).toThrow()
  expect(() => parseTaxRateWriteData({ name: {} as unknown as string })).toThrow()
})


test('native inventory writes read back their own locked transaction and refuse invalid stock', async () => {
  const { refreshDatabase } = await import('./setup')
  await refreshDatabase()
  const { store } = await import('../products/items/store')
  const { restock, updateInventory } = await import('../products/items/update')
  const product = await store({ name: 'Stocked item', price: 100, inventory_count: 10, preparation_time: 1 })
  const writes = await Promise.all([restock(Number(product.id), 3), restock(Number(product.id), 4)])
  expect(writes.map(row => Number(row!.inventory_count)).sort((a, b) => a - b)).toEqual([13, 17])
  await expect(updateInventory(Number(product.id), true as unknown as number)).rejects.toThrow()
  expect(Number((await updateInventory(Number(product.id)))!.inventory_count)).toBe(17)
})


test('native tax writes preserve optional empty codes and false booleans', async () => {
  const { refreshDatabase } = await import('./setup')
  await refreshDatabase()
  const { store } = await import('../tax/store')
  const { update } = await import('../tax/update')
  const created = await store({ name: 'Local', rate: 7.5, type: 'sales', country: 'USA', code: '', is_default: 'false' as unknown as boolean, exemptible: 'false' as unknown as boolean })
  expect(created.code).toBe('')
  const tagged = await update(Number(created.id), { code: 'local' })
  expect(tagged!.code).toBe('local')
  const cleared = await update(Number(created.id), { code: '', is_default: 'false' as unknown as boolean })
  expect(cleared!.code).toBe('')
  expect(cleared!.is_default === false || Number(cleared!.is_default) === 0).toBe(true)
})


test('opposite cart item orders reserve stock atomically without a lock-order cycle', async () => {
  const { refreshDatabase } = await import('./setup')
  await refreshDatabase()
  const { store } = await import('../products/items/store')
  const { adjustInventoryMany } = await import('../products/items/update')
  const first = await store({ name: 'One', price: 100, inventory_count: 10, preparation_time: 1 })
  const second = await store({ name: 'Two', price: 100, inventory_count: 10, preparation_time: 1 })
  const ids = [Number(first.id), Number(second.id)]
  const results = await Promise.all([adjustInventoryMany(ids.map(id => ({ id, delta: -1 }))), adjustInventoryMany([...ids].reverse().map(id => ({ id, delta: -1 })))])
  expect(results.every(result => result.ok)).toBe(true)
  const { db } = await import('@stacksjs/database/runtime')
  const stock = await db.selectFrom('products').select(['id', 'inventory_count']).where('id', 'in', ids).execute()
  expect(stock.map(row => Number(row.inventory_count))).toEqual([8, 8])
})
