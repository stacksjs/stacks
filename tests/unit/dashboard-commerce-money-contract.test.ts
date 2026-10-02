import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { makeModelRecords } from '@stacksjs/database'
import { campaignWriteData, validateCampaignWriteData } from '../../storage/framework/defaults/app/Actions/Dashboard/Marketing/campaign-records'
import { totalsFor } from '../../storage/framework/defaults/app/Actions/Storefront/_shipping'
import { storefrontSummary } from '../../storage/framework/defaults/app/Storefront/StorefrontMoney'
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
 * payment-provider amounts (abandoned-cart totals, sales analytics, billing,
 * campaign budgets and spend).
 *
 * Not listed, on purpose: analytics event values, which are stored as
 * decimal major units, and UI/Table's generic `currency` column.
 */
const minorUnitSources = [
  ...stxFiles(commerceDir),
  ...stxFiles(join(dashboardDir, 'Marketing')),
  ...stxFiles(join(dashboardDir, 'Billing')),
  ...stxFiles(join(dashboardDir, 'Transaction')),
  join(dashboardDir, 'Analytics/SalesAnalytics.stx'),
  join(dashboardDir, 'Analytics/CampaignAnalytics.stx'),
]

const defaultsDir = resolve('storage/framework/defaults')
const viewsDir = join(defaultsDir, 'resources/views')

/**
 * The storefront's pages and the cart drawer: cart_items, order_items and
 * orders hold integer minor units, and these used to print them with a
 * hardcoded `$` and `.toFixed(2)`.
 */
const storefrontSources = [
  join(viewsDir, 'cart.stx'),
  join(viewsDir, 'checkout/contact.stx'),
  join(viewsDir, 'checkout/shipping.stx'),
  join(viewsDir, 'checkout/payment.stx'),
  join(viewsDir, 'orders/[id].stx'),
  join(defaultsDir, 'resources/components/Storefront/CartDrawer.stx'),
  join(defaultsDir, 'app/Mail/OrderConfirmation.ts'),
  resolve('resources/emails/order-confirmation.stx'),
]

/** Formatting or scaling money by hand, in any of the shapes it has taken. */
function formatsMoneyByHand(code: string): boolean {
  return code.includes('style: \'currency\'')
    || /\.toFixed\(/.test(code)
    || /\$\$\{/.test(code)
    || /'\$'\s*\+/.test(code)
    || /\$\{\{/.test(code)
    || /\/\s*100\b/.test(code)
    || /\*\s*100\b/.test(code)
}

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

describe('storefront money', () => {
  test('no storefront page, drawer or receipt formats money or scales cents by hand', () => {
    const offenders = storefrontSources.filter(file => formatsMoneyByHand(readFileSync(file, 'utf8')))
    expect(offenders.map(file => file.slice(resolve('.').length + 1))).toEqual([])
  })

  test('the pages format through the storefront helper, in the cart or order currency', () => {
    for (const page of ['cart.stx', 'checkout/contact.stx', 'checkout/shipping.stx', 'checkout/payment.stx']) {
      const code = readFileSync(join(viewsDir, page), 'utf8')
      expect(code).toContain('app/Storefront/StorefrontMoney\')')
      expect(code).toContain('storefrontSummary(subtotal, storefrontCurrency(cart?.currency))')
      expect(code).toContain('storefrontCurrency(row.currency)')
    }

    const order = readFileSync(join(viewsDir, 'orders/[id].stx'), 'utf8')
    expect(order).toContain('storefrontCurrency(order?.currency)')
    expect(order).toContain('{{ totalLabel }}')

    expect(readFileSync(join(defaultsDir, 'app/Storefront/StorefrontMoney.ts'), 'utf8')).toMatch(sharedFormatter)
    expect(readFileSync(join(defaultsDir, 'app/Mail/OrderConfirmation.ts'), 'utf8')).toMatch(sharedFormatter)
  })

  test('the cart drawer shows the labels /api/cart formatted', () => {
    const drawer = readFileSync(join(defaultsDir, 'resources/components/Storefront/CartDrawer.stx'), 'utf8')
    expect(drawer).toContain('render(data.items || [], data.subtotalLabel || \'\')')
    const action = readFileSync(join(defaultsDir, 'app/Actions/Storefront/GetCartAction.ts'), 'utf8')
    expect(action).toContain('lineTotalLabel: storefrontMoney(lineTotal, currency)')
    expect(action).toContain('subtotalLabel: storefrontMoney(subtotal, currency)')
  })

  test('shipping thresholds are minor units of the cart currency, not 40 cents', () => {
    // A $19.99 cart pays the $5.00 flat rate and is $20.01 short of free shipping.
    expect(totalsFor(1999, 'USD')).toEqual({ subtotal: 1999, shipping: 500, total: 2499, remainingForFree: 2001 })
    expect(totalsFor(4000, 'USD')).toEqual({ subtotal: 4000, shipping: 0, total: 4000, remainingForFree: 0 })
    expect(totalsFor(0, 'USD')).toEqual({ subtotal: 0, shipping: 0, total: 0, remainingForFree: 0 })
    // JPY has no minor unit: the default "40" is 40 yen.
    expect(totalsFor(39, 'JPY').shipping).toBe(5)

    const summary = storefrontSummary(1999, 'USD')
    expect(summary.subtotalLabel).toBe(formatCurrency(1999, 'USD'))
    expect(summary.shippingLabel).toBe(formatCurrency(500, 'USD'))
    expect(summary.totalLabel).toBe(formatCurrency(2499, 'USD'))
    expect(summary.freeShippingNote).toBe(`Add ${formatCurrency(2001, 'USD')} more for free shipping.`)
    expect(storefrontSummary(4000, 'USD').shippingLabel).toBe('Free')
  })

  test('the place-order action charges with the same rule, in the cart currency', () => {
    const action = readFileSync(join(defaultsDir, 'app/Actions/Storefront/PlaceOrderAction.ts'), 'utf8')
    expect(action).toContain('totalsFor(itemsSubtotal, currency)')
    expect(action).toMatch(/total_amount: total,\s+currency,/)
  })
})

describe('CMS form block money', () => {
  const block = readFileSync(join(viewsDir, 'cms/blocks/form.stx'), 'utf8')

  test('a currency field is parsed by the shared helper, not float math', () => {
    expect(block).toMatch(/import \{[^}]*\bparseMoneyInput\b[^}]*\} from '@stacksjs\/commerce\/money'/)
    expect(block).not.toMatch(/Math\.round\(/)
    expect(block).not.toMatch(/\*\s*100\b/)
    expect(block).toContain('parseMoneyInput(raw, currency, { required: false })')
    expect(block).toContain('@input="setInput(field, $event.target.value)"')
    expect(block).toContain(':step="field.type === \'currency\' ? moneyInputStep(formCurrency()) : null"')
  })
})

describe('campaign budget and spend', () => {
  test('the dialog types major units and sends minor units', () => {
    const dialog = dashboardSource('Marketing/CampaignDialog.stx')
    expect(dialog).not.toContain('step="0.01"')
    expect(dialog).toContain(':step="moneyInputStep(currency())"')
    expect(dialog).toContain('budget: parseMoneyInput(budget(), code, { required: false }),')
    expect(dialog).toContain('minorToInput(current.budget, recordCurrency)')
    expect(dashboardSource('Analytics/CampaignAnalytics.stx')).toMatch(sharedFormatter)
  })

  test('the write path refuses a budget that is not whole minor units', () => {
    const base = { name: 'Spring launch', type: 'social', status: 'draft' }
    const valid = campaignWriteData({ ...base, budget: 150000, spent: '2599' })
    expect(valid).toMatchObject({ budget: 150000, spent: 2599 })
    expect(validateCampaignWriteData(valid)).toBe('')
    expect(campaignWriteData({ ...base, budget: '' }).budget).toBeNull()

    expect(validateCampaignWriteData(campaignWriteData({ ...base, budget: '1500.50' })))
      .toBe('Campaign budgets must be a whole number of minor units, for example 1999 for 19.99.')
    expect(validateCampaignWriteData(campaignWriteData({ ...base, spent: -1 })))
      .toBe('Campaign spend must be a whole number of minor units, for example 1999 for 19.99.')
  })

  test('seeded campaigns hold whole minor units and never overspend', async () => {
    const campaigns = await makeModelRecords('Campaign', 40)
    expect(campaigns.length).toBe(40)
    for (const campaign of campaigns) {
      expect(Number.isSafeInteger(campaign.budget)).toBe(true)
      expect(Number.isSafeInteger(campaign.spent)).toBe(true)
      expect(campaign.budget as number).toBeGreaterThanOrEqual(10000)
      expect(campaign.spent as number).toBeLessThanOrEqual(campaign.budget as number)
    }
  })
})
