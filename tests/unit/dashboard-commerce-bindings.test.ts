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

      // The shared search box and dropdown, bound both ways (stacksjs/stacks#3310).
      expect(source).toContain('<SearchFilter v-model:searchValue="search"')
      expect(source).toMatch(/<Select v-model:value="sort"/)
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

      expect(source).toContain('<SearchFilter v-model:searchValue="search"')
      expect(source).toContain('<Select v-model:value="status"')
      expect(source).not.toMatch(/function update(?:Search|Status)\(/)
    }
  })

  test('POS catalog emits signal values through component events', () => {
    const componentRoot = resolve(
      'storage/framework/defaults/resources/components/Dashboard/Commerce',
    )
    const catalog = readFileSync(resolve(componentRoot, 'CommercePosCatalog.stx'), 'utf8')
    const dashboard = readFileSync(resolve(componentRoot, 'CommercePosDashboard.stx'), 'utf8')

    expect(catalog).toContain('<SearchFilter v-model:searchValue="search"')
    expect(catalog).toContain('@search="emit(\'search\', $event)"')
    expect(catalog).toContain('@change="emit(\'category\', $event)"')
    expect(dashboard).toContain('@search="search.set($event)"')
    expect(dashboard).not.toMatch(/function update(?:Search|Category|Availability)\(/)
  })

  test('simple entity dialogs bind their fields to signals', () => {
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

      expect(source).toMatch(/(?:x-model(?:\.\w+)?|v-model:(?:value|checked))="/)
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
    }
  })

  test('customer, review, and refund dialogs bind their fields to signals', () => {
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

      expect(source).toMatch(/(?:x-model(?:\.\w+)?|v-model:(?:value|checked))="/)
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
    // A string model, so the select can hold "No rating" as well as 1 to 5
    // (stacksjs/stacks#2999); the dialog converts it to a number or null.
    expect(review).toContain('v-model:value="rating"')
    expect(review).toContain("{ value: '', label: 'No rating' }")
  })

  test('gift card dialog binds its fields to signals with isolated balance syncing', () => {
    const source = readFileSync(
      resolve(
        'storage/framework/defaults/resources/components/Dashboard/Commerce',
        'CommerceGiftCardDialog.stx',
      ),
      'utf8',
    )

    expect(source).toContain('v-model:value="initialBalance"')
    expect(source).toContain('@input="syncCurrentBalance($event)"')
    expect(source).toContain('v-model:value="currentBalance"')
    expect(source).toContain('let previousInitialBalance')
    expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
    expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
  })

  test('category, printer, and waitlist forms bind their fields to signals', () => {
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

      expect(source).toMatch(/(?:x-model(?:\.\w+)?|v-model:(?:value|checked))="/)
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
      expect(source).toContain('v-model:value="customerId"')
      expect(source).toContain('@change="hydrateCustomer($event)"')
      expect(source).not.toContain('customerId.set(selectedId)')
    }
  })

  test('coupon, checkout, and overview controls bind to signals', () => {
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

      expect(source).toMatch(/(?:x-model(?:\.\w+)?|v-model:(?:value|checked))="/)
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
    // The dropdown hands the handler the range chosen.
    expect(overview).toContain('@change="reloadSelectedRange"')
    expect(overview).toContain('function reloadSelectedRange(next: string): void {')
    expect(overview).not.toContain('range.set(')
  })

  test('product and order forms bind their fields to signals', () => {
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

      expect(source).toMatch(/(?:x-model(?:\.\w+)?|v-model:(?:value|checked))="/)
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
