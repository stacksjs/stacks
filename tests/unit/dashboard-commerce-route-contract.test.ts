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

  test('gift card mutations use guarded dashboard routes and model field normalization', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const giftCards = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceGiftCardsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/GiftCardStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/GiftCardUpdateAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/gift-cards', 'Actions/Commerce/GiftCardStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/gift-cards/{id}', 'Actions/Commerce/GiftCardUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/gift-cards/{id}', 'Actions/Commerce/GiftCardDestroyAction'))")
    expect(giftCards).toContain('/api/dashboard/commerce/gift-cards')
    expect(giftCards).not.toMatch(/\/api\/gift-cards(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: GiftCard')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(updateAction).toContain("method: 'PATCH'")
  })

  test('order mutations use guarded dashboard routes and relationship normalization', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const orders = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceOrdersDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/OrderStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/OrderUpdateAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/orders', 'Actions/Commerce/OrderStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/orders/{id}', 'Actions/Commerce/OrderUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/orders/{id}', 'Actions/Commerce/OrderDestroyAction'))")
    expect(orders).toContain('/api/dashboard/commerce/orders')
    expect(orders).not.toMatch(/\/api\/orders(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Order')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(updateAction).toContain("method: 'PATCH'")
  })

  test('coupon mutations use guarded dashboard routes and complete model fields', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const coupons = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceCouponsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/CouponStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/CouponUpdateAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/coupons', 'Actions/Commerce/CouponStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/coupons/{id}', 'Actions/Commerce/CouponUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/coupons/{id}', 'Actions/Commerce/CouponDestroyAction'))")
    expect(coupons).toContain('/api/dashboard/commerce/coupons')
    expect(coupons).not.toMatch(/\/api\/coupons(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Coupon')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }
  })

  test('category mutations use guarded dashboard routes and preserve model fields', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const categories = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceCategoriesDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductCategoryStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductCategoryUpdateAction.ts')
    const store = source('storage/framework/core/commerce/src/products/categories/store.ts')
    const update = source('storage/framework/core/commerce/src/products/categories/update.ts')

    expect(routes).toContain("guard(route.post('/commerce/categories', 'Actions/Commerce/Product/ProductCategoryStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/categories/{id}', 'Actions/Commerce/Product/ProductCategoryUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/categories/{id}', 'Actions/Commerce/Product/ProductCategoryDestroyAction'))")
    expect(categories).toContain('/api/dashboard/commerce/categories')
    expect(categories).not.toMatch(/\/api\/product-categories(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Category')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(store).not.toContain("categorizable_type: 'product'")
    expect(store).not.toContain("slug: data.name?.toLowerCase()")
    expect(update).toContain('...data')
    expect(updateAction).toContain("method: 'PATCH'")
  })

  test('manufacturer mutations use canonical guarded model actions', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const publicRoutes = source('storage/framework/defaults/routes/dashboard.ts')
    const manufacturers = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceManufacturersDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ManufacturerStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ManufacturerUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ManufacturerDestroyAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/manufacturers', 'Actions/Commerce/Product/ManufacturerStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerDestroyAction'))")
    expect(publicRoutes).toContain("route.patch('/product-manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerUpdateAction')")
    expect(publicRoutes).not.toContain('ProductManufacturerUpdateAction')
    expect(manufacturers).toContain('/api/dashboard/commerce/manufacturers')
    expect(manufacturers).not.toMatch(/\/api\/product-manufacturers(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Manufacturer')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(destroyAction).toContain('response.noContent()')
  })

  test('product unit mutations are guarded and save default state atomically', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const publicRoutes = source('storage/framework/defaults/routes/dashboard.ts')
    const units = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceUnitsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductUnitStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductUnitUpdateAction.ts')
    const store = source('storage/framework/core/commerce/src/products/units/store.ts')
    const update = source('storage/framework/core/commerce/src/products/units/update.ts')

    expect(routes).toContain("guard(route.post('/commerce/units', 'Actions/Commerce/Product/ProductUnitStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/units/{id}', 'Actions/Commerce/Product/ProductUnitUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/units/{id}', 'Actions/Commerce/Product/ProductUnitDestroyAction'))")
    expect(publicRoutes).toContain("route.patch('/products/units/{id}', 'Actions/Commerce/Product/ProductUnitUpdateAction')")
    expect(units).toContain('/api/dashboard/commerce/units')
    expect(units).not.toMatch(/\/api\/product-units(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: ProductUnit')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(store).toContain('db.transaction')
    expect(update).toContain('db.transaction')
    expect(units).not.toContain("did not return an ID")
  })
})
