import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { formatCurrency } from '../../storage/framework/core/commerce/src/money'

/**
 * stacksjs/stacks#2851: commerce amounts are stored as integer minor units, and
 * the dashboard converts them only at the display and input boundary, through
 * `@stacksjs/commerce/money`.
 *
 * The bug was nine components each owning a `formatMoney` that handed the
 * stored integer straight to `Intl.NumberFormat`, so a 1999-cent product read
 * $1,999.00, and a dialog that saved `Number("19.99")`. These pin the shape
 * that cannot drift back: no component formats currency itself, and the
 * product dialog sends what the shared payload builder produced.
 */

const dashboardDir = resolve('storage/framework/defaults/resources/components/Dashboard')
const commerceDir = join(dashboardDir, 'Commerce')

/**
 * Every component that shows an amount stored in minor units: the commerce
 * screens, plus the ones outside Dashboard/Commerce that read commerce or
 * payment-provider amounts (abandoned-cart totals, sales analytics, billing).
 *
 * Not listed, on purpose: Campaign budgets and analytics event values, which
 * are stored as decimal major units, and UI/Table's generic `currency` column.
 */
const minorUnitSources = [
  ...stxFiles(commerceDir),
  ...stxFiles(join(dashboardDir, 'Marketing')),
  ...stxFiles(join(dashboardDir, 'Billing')),
  ...stxFiles(join(dashboardDir, 'Transaction')),
  join(dashboardDir, 'Analytics/SalesAnalytics.stx'),
]

function stxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return stxFiles(path)
    return entry.name.endsWith('.stx') ? [path] : []
  })
}

function source(name: string): string {
  return readFileSync(join(commerceDir, name), 'utf8')
}

function dashboardSource(name: string): string {
  return readFileSync(join(dashboardDir, name), 'utf8')
}

const sharedFormatter = /import \{[^}]*\bformatCurrency\b[^}]*\} from '@stacksjs\/commerce\/money'/

describe('commerce dashboard money', () => {
  test('no component formats a currency or scales cents by hand', () => {
    const offenders = minorUnitSources.filter((file) => {
      const code = readFileSync(file, 'utf8')
      return code.includes('style: \'currency\'')
        || /\(\s*\w+(?:\.\w+)*\s*\/\s*100\s*\)\.toFixed\(2\)/.test(code)
        || /Math\.round\(\s*\w+\s*\*\s*100\s*\)/.test(code)
        || /\/\s*100\s*\)?\s*\.toFixed\(/.test(code)
        || /\.format\(\s*\w+(?:\.\w+)*\s*\/\s*100\s*\)/.test(code)
    })

    expect(offenders.map(file => file.slice(dashboardDir.length + 1))).toEqual([])
  })

  test('the components outside Dashboard/Commerce that show commerce money use the shared helper', () => {
    for (const name of [
      'Marketing/AbandonedCartsTable.stx',
      'Marketing/AbandonedCartsDashboard.stx',
      'Marketing/RecoveryCampaignDialog.stx',
      'Analytics/SalesAnalytics.stx',
      'Billing/BillingPlanSummary.stx',
      'Transaction/index.stx',
    ])
      expect(dashboardSource(name)).toMatch(sharedFormatter)
  })

  test('the recovery campaign threshold is typed in major units and sent in minor units', () => {
    const dialog = dashboardSource('Marketing/RecoveryCampaignDialog.stx')
    expect(dialog).toContain(':step="moneyInputStep(defaultCurrency())"')
    expect(dialog).toContain('minimumValue: minimumMinor(),')
    expect(dialog).not.toContain('Number(minimumValue())')
  })

  test('every component that shows money imports the shared helper', () => {
    for (const name of [
      'CommerceProductsTable.stx',
      'CommerceProductDetailDashboard.stx',
      'CommercePosCatalog.stx',
      'CommercePosCart.stx',
      'CommercePosCheckoutDialog.stx',
      'CommercePosReceiptDialog.stx',
      'CommerceOrdersTable.stx',
      'CommerceOrderDetailsDialog.stx',
      'CommerceCustomersTable.stx',
      'CommerceGiftCardsTable.stx',
      'CommercePaymentsTable.stx',
    ]) {
      expect(source(name)).toMatch(sharedFormatter)
    }
  })

  test('the products table shows a stored price of 1999 as $19.99', () => {
    const table = source('CommerceProductsTable.stx')
    expect(table).toContain('{{ formatMoney(record.price) }}')
    expect(table).toContain('return formatCurrency(value, currency())')
    // The function that template expression lands on, with the table's default currency.
    expect(formatCurrency(1999, 'USD', 'en-US')).toBe('$19.99')
  })

  test('the product dialog saves the integer the payload builder produced', () => {
    const dialog = source('CommerceProductDialog.stx')
    expect(dialog).toContain('emit(\'submit\', productWritePayload({')
    expect(dialog).not.toContain('Number(price())')
    expect(dialog).not.toContain('step="0.01"')
    expect(dialog).toContain(':step="moneyInputStep(currency())"')
    expect(dialog).toContain('minorToInput(current.price, currency())')
  })
})
