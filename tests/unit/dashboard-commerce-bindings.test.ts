import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const commerceComponents = [
  'CommerceProductsDashboard.stx',
  'CommerceCustomersDashboard.stx',
  'CommerceOrdersDashboard.stx',
  'CommerceCouponsDashboard.stx',
  'CommerceCategoriesDashboard.stx',
  'CommerceManufacturersDashboard.stx',
  'CommerceUnitsDashboard.stx',
  'CommerceVariantsDashboard.stx',
  'CommerceGiftCardsDashboard.stx',
  'CommercePaymentsDashboard.stx',
  'CommerceReviewsDashboard.stx',
  'CommerceTaxesDashboard.stx',
  'PrintDevicesDashboard.stx',
  'PrintLogsDashboard.stx',
]

describe('commerce dashboard filter bindings', () => {
  for (const component of commerceComponents) {
    test(`${component} uses native STX models`, () => {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model="search"')
      expect(source).toContain('x-model="sort"')
      expect(source).not.toMatch(/function update(?:Search|Sort)\(/)
      expect(source).not.toMatch(/:value="search\(\)"[^>]+@input=/)
      expect(source).not.toMatch(/:value="sort\(\)"[^>]+@change=/)
    })
  }

  test('waitlists bind their filters directly to signals', () => {
    for (const component of [
      'ProductWaitlistDashboard.stx',
      'RestaurantWaitlistDashboard.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model="search"')
      expect(source).toContain('x-model="status"')
      expect(source).not.toMatch(/function update(?:Search|Status)\(/)
    }
  })

  test('POS catalog emits signal values through component events', () => {
    const componentRoot = resolve(
      'storage/framework/defaults/resources/components/Dashboard/Commerce',
    )
    const catalog = readFileSync(resolve(componentRoot, 'CommercePosCatalog.stx'), 'utf8')
    const dashboard = readFileSync(resolve(componentRoot, 'CommercePosDashboard.stx'), 'utf8')

    expect(catalog).toContain('x-model="search"')
    expect(catalog).toContain('emit(\'search\', $event.target.value)')
    expect(dashboard).toContain('@search="search.set($event)"')
    expect(dashboard).not.toMatch(/function update(?:Search|Category|Availability)\(/)
  })

  test('simple entity dialogs use native field models', () => {
    for (const component of [
      'CommerceManufacturerDialog.stx',
      'CommerceUnitDialog.stx',
      'CommerceVariantDialog.stx',
      'CommerceTaxDialog.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }
  })

  test('customer, review, and refund dialogs use native field models', () => {
    for (const component of [
      'CommerceCustomerDialog.stx',
      'CommerceReviewEditDialog.stx',
      'PaymentRefundDialog.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }

    const review = readFileSync(
      resolve(
        'storage/framework/defaults/resources/components/Dashboard/Commerce',
        'CommerceReviewEditDialog.stx',
      ),
      'utf8',
    )
    expect(review).toContain('x-model.number="rating"')
  })

  test('gift card dialog uses native field models with isolated balance syncing', () => {
    const source = readFileSync(
      resolve(
        'storage/framework/defaults/resources/components/Dashboard/Commerce',
        'CommerceGiftCardDialog.stx',
      ),
      'utf8',
    )

    expect(source).toContain('x-model="initialBalance"')
    expect(source).toContain('@input="syncCurrentBalance($event)"')
    expect(source).toContain('x-model="currentBalance"')
    expect(source).toContain('let previousInitialBalance')
    expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
    expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
  })

  test('category, printer, and waitlist forms use native field models', () => {
    for (const component of [
      'CommerceCategoryDialog.stx',
      'PrintDeviceDialog.stx',
      'ProductWaitlistEntryDialog.stx',
      'RestaurantWaitlistEntryDialog.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }

    const category = readFileSync(
      resolve(
        'storage/framework/defaults/resources/components/Dashboard/Commerce',
        'CommerceCategoryDialog.stx',
      ),
      'utf8',
    )
    expect(category).toContain('@blur="normalizeSlug"')

    for (const component of [
      'ProductWaitlistEntryDialog.stx',
      'RestaurantWaitlistEntryDialog.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )
      expect(source).toContain('x-model="customerId"')
      expect(source).toContain('@change="hydrateCustomer($event)"')
      expect(source).not.toContain('customerId.set(selectedId)')
    }
  })

  test('coupon, checkout, and overview controls use native field models', () => {
    for (const component of [
      'CommerceCouponDialog.stx',
      'CommercePosCheckoutDialog.stx',
      'CommerceOverviewDashboard.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }

    const overview = readFileSync(
      resolve(
        'storage/framework/defaults/resources/components/Dashboard/Commerce',
        'CommerceOverviewDashboard.stx',
      ),
      'utf8',
    )
    expect(overview).toContain('reloadSelectedRange($event)')
    expect(overview).not.toContain('range.set(')
  })

  test('product and order forms use native field models', () => {
    for (const component of [
      'CommerceProductDialog.stx',
      'CommerceOrderDialog.stx',
    ]) {
      const source = readFileSync(
        resolve(
          'storage/framework/defaults/resources/components/Dashboard/Commerce',
          component,
        ),
        'utf8',
      )

      expect(source).toContain('x-model=')
      expect(source).not.toContain('function inputValue(')
      expect(source).not.toMatch(/function (?:set|toggle)[A-Z]\w*\(event: Event\)/)
    }
  })

  test('commerce components do not manually mirror control values into signals', () => {
    const componentRoot = resolve(
      'storage/framework/defaults/resources/components/Dashboard/Commerce',
    )

    for (const component of readdirSync(componentRoot).filter(file => file.endsWith('.stx'))) {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }
  })
})
