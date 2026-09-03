import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Comment from '../../../defaults/app/Models/Comment'
import EmailIdempotency from '../../../defaults/app/Models/EmailIdempotency'
import EmailSuppression from '../../../defaults/app/Models/EmailSuppression'
import EmailWebhookEvent from '../../../defaults/app/Models/EmailWebhookEvent'
// `Request` is a model name that shadows the global, so it is aliased here for
// the same reason the auto-import generator skips injecting it.
import RequestModel from '../../../defaults/app/Models/Request'
import Notification from '../../../defaults/app/Models/Notification'
import NotificationDelivery from '../../../defaults/app/Models/NotificationDelivery'
import Auction from '../../../defaults/app/Models/commerce/Auction'
import AuctionItem from '../../../defaults/app/Models/commerce/AuctionItem'
import Cart from '../../../defaults/app/Models/commerce/Cart'
import CartItem from '../../../defaults/app/Models/commerce/CartItem'
import Coupon from '../../../defaults/app/Models/commerce/Coupon'
import Customer from '../../../defaults/app/Models/commerce/Customer'
import DeliveryRoute from '../../../defaults/app/Models/commerce/DeliveryRoute'
import DigitalDelivery from '../../../defaults/app/Models/commerce/DigitalDelivery'
import Courier from '../../../defaults/app/Models/commerce/Courier'
import GiftCard from '../../../defaults/app/Models/commerce/GiftCard'
import LicenseKey from '../../../defaults/app/Models/commerce/LicenseKey'
import LoyaltyPoint from '../../../defaults/app/Models/commerce/LoyaltyPoint'
import Payment from '../../../defaults/app/Models/commerce/Payment'
import PrintDevice from '../../../defaults/app/Models/commerce/PrintDevice'
import Receipt from '../../../defaults/app/Models/commerce/Receipt'
import Transaction from '../../../defaults/app/Models/commerce/Transaction'

const PUBLIC_MODEL_APIS = [
  'Author',
  'Category',
  'LoyaltyReward',
  'Manufacturer',
  // Page and Post are deliberately ABSENT: since pages became block
  // documents and posts gained drafts-by-status, their generated reads are
  // auth'd admin surfaces - public visitors get published content through
  // the site's own routes, which filter by status.
  'Product',
  'ProductUnit',
  'ProductVariant',
  'Release',
  'ShippingMethod',
  'ShippingRate',
  'ShippingZone',
  'Tag',
  'TaxRate',
]

function modelFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const file = join(path, entry)
    return statSync(file).isDirectory()
      ? modelFiles(file)
      : file.endsWith('.ts') ? [file] : []
  })
}

function objectBlock(source: string, start: number): string {
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{')
      depth += 1
    else if (source[index] === '}' && --depth === 0)
      return source.slice(start, index + 1)
  }
  return ''
}

describe('sensitive model API security', () => {
  test.each([
    ['cart', Cart],
    ['cart item', CartItem],
    ['comment', Comment],
    ['coupon', Coupon],
    ['customer', Customer],
    ['delivery route', DeliveryRoute],
    ['digital delivery', DigitalDelivery],
    ['courier', Courier],
    ['gift card', GiftCard],
    ['license key', LicenseKey],
    ['loyalty point', LoyaltyPoint],
    ['notification', Notification],
    ['notification delivery', NotificationDelivery],
    ['payment', Payment],
    ['print device', PrintDevice],
    ['receipt', Receipt],
    ['transaction', Transaction],
  ])('protects every generated %s API route', (_name, model) => {
    expect(model.traits.useApi).toMatchObject({
      middleware: ['auth'],
    })
  })

  test.each([
    ['auction', Auction],
    ['auction item', AuctionItem],
  ])('protects generated %s reads and writes', (_name, model) => {
    expect(model.traits.useApi).toMatchObject({
      middleware: { read: ['auth'], write: ['auth'] },
    })
  })

  /*
   * Infrastructure tables: readable by any authenticated caller, writable only
   * by an admin.
   *
   * These declare `ownership: false` - nothing owns an idempotency key - so row
   * scoping cannot gate them and `auth` alone was the whole guard. That let any
   * signed-in caller DELETE them, and each deletion does real damage: dropping
   * an EmailSuppression re-enables mail to someone who bounced or opted out,
   * dropping an EmailIdempotency lets a retry send twice, and the other two are
   * audit trails (stacksjs/stacks#2412).
   *
   * Reads are deliberately left at `auth`, so this tightens the destructive
   * side without changing who can look.
   */
  test.each([
    ['email suppression', EmailSuppression],
    ['email webhook event', EmailWebhookEvent],
    ['email idempotency', EmailIdempotency],
    ['request log', RequestModel],
  ])('requires an admin to write %s rows', (_name, model) => {
    expect(model.traits.useApi).toMatchObject({
      middleware: { read: ['auth'], write: ['auth', 'role:admin'] },
    })
  })

  test('keeps anonymous generated reads on an explicit public catalog allowlist', () => {
    // Relative to this file rather than the working directory: run from
    // inside the package, a cwd-relative path resolves to
    // `core/orm/storage/framework/...` and the scan throws ENOENT — which
    // failed a security assertion for a reason that had nothing to do with
    // security.
    const publicModels = modelFiles(resolve(import.meta.dir, '../../../defaults/app/Models'))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8')
        const start = source.indexOf('useApi:')
        if (start < 0)
          return []
        const block = objectBlock(source, start)
        const flatAuth = /middleware\s*:\s*\[[^\]]*['"]auth['"]/.test(block)
        const readAuth = /middleware\s*:\s*\{[^}]*read\s*:\s*\[[^\]]*['"]auth['"]/.test(block)
        if (flatAuth || readAuth)
          return []
        const name = source.match(/name:\s*['"]([^'"]+)/)?.[1]
        return name ? [name] : []
      })
      .sort()

    expect(publicModels).toEqual([...PUBLIC_MODEL_APIS].sort())
  })
})
