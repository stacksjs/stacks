import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard commerce route contract', () => {
  test('product mutations use local-friendly guarded dashboard routes', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const products = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceProductsDashboard.stx')
    const detail = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceProductDetailDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductStoreAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/products', 'Actions/Commerce/Product/ProductStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/products/{id}', 'Actions/Commerce/Product/ProductUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/products/{id}', 'Actions/Commerce/Product/ProductDestroyAction'))")

    for (const component of [products, detail]) {
      expect(component).toContain('/api/dashboard/commerce/products')
      expect(component).not.toMatch(/\/api\/products(?:\/|\?|'|`)/)
    }

    expect(storeAction).toContain('model: Product')
    expect(storeAction).toContain('await request.validate()')
  })

  test('customer mutations use the guarded dashboard route and complete model fields', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const customers = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceCustomersDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/CustomerStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/CustomerUpdateAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/customers', 'Actions/Commerce/CustomerStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/customers/{id}', 'Actions/Commerce/CustomerUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/customers/{id}', 'Actions/Commerce/CustomerDestroyAction'))")
    expect(customers).toContain('/api/dashboard/commerce/customers')
    expect(customers).not.toMatch(/\/api\/customers(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Customer')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys({')
      expect(action).toContain("request.get('totalSpent')")
      expect(action).toContain("request.get('lastOrder')")
      expect(action).toContain("request.get('avatar')")
    }

    expect(storeAction).not.toContain('user_id: 1')
  })
})
