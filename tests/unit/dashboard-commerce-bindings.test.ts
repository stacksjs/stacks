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
})
