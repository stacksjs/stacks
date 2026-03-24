import { describe, expect, test } from 'bun:test'

describe('commerce module', () => {
  test('commerce namespace is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.commerce).toBeDefined()
    expect(typeof mod.commerce).toBe('object')
  })

  test('default export equals commerce namespace', async () => {
    const mod = await import('../src/index')
    expect(mod.default).toBe(mod.commerce)
  })

  test('coupons submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.coupons).toBeDefined()
    expect(typeof mod.coupons).toBe('object')
    expect(mod.commerce.coupons).toBe(mod.coupons)
  })

  test('customers submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.customers).toBeDefined()
    expect(typeof mod.customers).toBe('object')
    expect(mod.commerce.customers).toBe(mod.customers)
  })

  test('devices submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.devices).toBeDefined()
    expect(typeof mod.devices).toBe('object')
    expect(mod.commerce.devices).toBe(mod.devices)
  })

  test('errors submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.errors).toBeDefined()
    expect(typeof mod.errors).toBe('object')
    expect(mod.commerce.errors).toBe(mod.errors)
  })

  test('giftCards submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.giftCards).toBeDefined()
    expect(typeof mod.giftCards).toBe('object')
    expect(mod.commerce.giftCards).toBe(mod.giftCards)
  })

  test('orders submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.orders).toBeDefined()
    expect(typeof mod.orders).toBe('object')
    expect(mod.commerce.orders).toBe(mod.orders)
  })

  test('payments submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.payments).toBeDefined()
    expect(typeof mod.payments).toBe('object')
    expect(mod.commerce.payments).toBe(mod.payments)
  })

  test('products submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.products).toBeDefined()
    expect(typeof mod.products).toBe('object')
    expect(mod.commerce.products).toBe(mod.products)
  })

  test('receipts submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.receipts).toBeDefined()
    expect(typeof mod.receipts).toBe('object')
    expect(mod.commerce.receipts).toBe(mod.receipts)
  })

  test('restaurant submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.restaurant).toBeDefined()
    expect(typeof mod.restaurant).toBe('object')
    expect(mod.commerce.restaurant).toBe(mod.restaurant)
  })

  test('shippings submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.shippings).toBeDefined()
    expect(typeof mod.shippings).toBe('object')
    expect(mod.commerce.shippings).toBe(mod.shippings)
  })

  test('tax submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.tax).toBeDefined()
    expect(typeof mod.tax).toBe('object')
    expect(mod.commerce.tax).toBe(mod.tax)
  })

  test('waitlists submodule is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.waitlists).toBeDefined()
    expect(typeof mod.waitlists).toBe('object')
    expect(mod.commerce.waitlists).toBe(mod.waitlists)
  })

  test('commerce namespace contains exactly 13 submodules', async () => {
    const mod = await import('../src/index')
    const keys = Object.keys(mod.commerce)
    expect(keys).toContain('coupons')
    expect(keys).toContain('customers')
    expect(keys).toContain('devices')
    expect(keys).toContain('errors')
    expect(keys).toContain('giftCards')
    expect(keys).toContain('orders')
    expect(keys).toContain('payments')
    expect(keys).toContain('products')
    expect(keys).toContain('receipts')
    expect(keys).toContain('restaurant')
    expect(keys).toContain('shippings')
    expect(keys).toContain('tax')
    expect(keys).toContain('waitlists')
    expect(keys.length).toBe(13)
  })
})
