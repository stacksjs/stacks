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

  test('tax rate mutations are guarded and save complete state atomically', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const taxes = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceTaxesDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/TaxRateStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/TaxRateUpdateAction.ts')
    const store = source('storage/framework/core/commerce/src/tax/store.ts')
    const update = source('storage/framework/core/commerce/src/tax/update.ts')

    expect(routes).toContain("guard(route.post('/commerce/taxes', 'Actions/Commerce/TaxRateStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/taxes/{id}', 'Actions/Commerce/TaxRateUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/taxes/{id}', 'Actions/Commerce/TaxRateDestroyAction'))")
    expect(taxes).toContain('/api/dashboard/commerce/taxes')
    expect(taxes).not.toMatch(/\/api\/tax-rates(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: TaxRate')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(store).toContain('db.transaction')
    expect(update).toContain('db.transaction')
    expect(update).toContain('...data')
    expect(taxes).not.toContain("did not return an ID")
  })

  test('product variant mutations use guarded model actions and relationship normalization', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const variants = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceVariantsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductVariantStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductVariantUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/Product/ProductVariantDestroyAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/variants', 'Actions/Commerce/Product/ProductVariantStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/variants/{id}', 'Actions/Commerce/Product/ProductVariantUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/variants/{id}', 'Actions/Commerce/Product/ProductVariantDestroyAction'))")
    expect(variants).toContain('/api/dashboard/commerce/variants')
    expect(variants).not.toMatch(/\/api\/product-variants(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: ProductVariant')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(variants).toContain('options: JSON.stringify(payload.options)')
    expect(destroyAction).toContain('response.noContent()')
  })

  test('print device mutations are guarded and preserve operational state during edits', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const devices = source('storage/framework/defaults/resources/components/Dashboard/Commerce/PrintDevicesDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/PrintDeviceStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/PrintDeviceUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/PrintDeviceDestroyAction.ts')
    const model = source('storage/framework/defaults/app/Models/commerce/PrintDevice.ts')
    const store = source('storage/framework/core/commerce/src/devices/store.ts')

    expect(routes).toContain("guard(route.post('/commerce/print-devices', 'Actions/Commerce/PrintDeviceStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyAction'))")
    expect(devices).toContain('/api/dashboard/commerce/print-devices')
    expect(devices).not.toMatch(/\/api\/print-devices(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: PrintDevice')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(devices).toContain('body: payload')
    expect(devices).not.toContain('Date.now()')
    expect(devices).not.toContain('current.lastPing')
    expect(devices).not.toContain('current.printCount')
    expect(model).toMatch(/lastPing:\s*{[\s\S]*?default: 0,[\s\S]*?rule: schema\.unix\(\)/)
    expect(model).toMatch(/printCount:\s*{[\s\S]*?default: 0,[\s\S]*?rule: schema\.number\(\)\.min\(0\)/)
    expect(store).toContain('last_ping: 0')
    expect(store).toContain('print_count: 0')
    expect(destroyAction).toContain('response.noContent()')
  })

  test('print log deletion uses a guarded native Receipt action', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const logs = source('storage/framework/defaults/resources/components/Dashboard/Commerce/PrintLogsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/ReceiptStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/ReceiptUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/ReceiptDestroyAction.ts')

    expect(routes).toContain("guard(route.delete('/commerce/print-logs/{id}', 'Actions/Commerce/ReceiptDestroyAction'))")
    expect(logs).toContain('/api/dashboard/commerce/print-logs')
    expect(logs).not.toMatch(/\/api\/print-logs(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Receipt')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(destroyAction).toContain("commerceIdentifier(request, 'Receipt')")
    expect(destroyAction).toContain('const deleted = await receipts.destroy(id)')
    expect(destroyAction).toContain("commerceNotFound('Receipt', id)")
    expect(destroyAction).toContain('response.noContent()')
  })

  test('review moderation uses guarded complete model actions', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const publicRoutes = source('storage/framework/defaults/routes/dashboard.ts')
    const reviews = source('storage/framework/defaults/resources/components/Dashboard/Commerce/CommerceReviewsDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/ReviewStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/ReviewUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/ReviewDestroyAction.ts')

    expect(routes).toContain("guard(route.patch('/commerce/reviews/{id}', 'Actions/Commerce/ReviewUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/reviews/{id}', 'Actions/Commerce/ReviewDestroyAction'))")
    expect(publicRoutes).toContain("route.delete('/products/reviews/{id}', 'Actions/Commerce/ReviewDestroyAction')")
    expect(reviews).toContain('/api/dashboard/commerce/reviews')
    expect(reviews).not.toMatch(/\/api\/product-reviews(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: Review')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(reviews).toContain('title: review.title')
    expect(reviews).toContain('content: review.content')
    expect(reviews).toContain('rating: review.rating')
    expect(destroyAction).toContain('products.reviews.destroy(id)')
    expect(destroyAction).toContain('response.noContent()')
  })

  test('product waitlist mutations use guarded complete model actions', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const waitlist = source('storage/framework/defaults/resources/components/Dashboard/Commerce/ProductWaitlistDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistProductStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistProductUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistProductDestroyAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/waitlist-products', 'Actions/Commerce/WaitlistProductStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductDestroyAction'))")
    expect(waitlist).toContain('/api/dashboard/commerce/waitlist-products')
    expect(waitlist).not.toMatch(/\/api\/waitlist-products(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: WaitlistProduct')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(destroyAction).toContain('response.noContent()')
  })

  test('restaurant waitlist mutations use guarded complete model actions', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const waitlist = source('storage/framework/defaults/resources/components/Dashboard/Commerce/RestaurantWaitlistDashboard.stx')
    const storeAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistRestaurantStoreAction.ts')
    const updateAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistRestaurantUpdateAction.ts')
    const destroyAction = source('storage/framework/defaults/app/Actions/Commerce/WaitlistRestaurantDestroyAction.ts')

    expect(routes).toContain("guard(route.post('/commerce/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantStoreAction'))")
    expect(routes).toContain("guard(route.patch('/commerce/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateAction'))")
    expect(routes).toContain("guard(route.delete('/commerce/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyAction'))")
    expect(waitlist).toContain('/api/dashboard/commerce/waitlist-restaurants')
    expect(waitlist).not.toMatch(/\/api\/waitlist-restaurants(?:\/|\?|'|`)/)

    for (const action of [storeAction, updateAction]) {
      expect(action).toContain('model: WaitlistRestaurant')
      expect(action).toContain('await request.validate()')
      expect(action).toContain('toSnakeCaseKeys(request.all())')
    }

    expect(destroyAction).toContain('response.noContent()')
  })
})
