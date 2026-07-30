import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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
})
