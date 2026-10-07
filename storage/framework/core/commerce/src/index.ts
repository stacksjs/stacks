// Main commerce module index file
import * as auctions from './auctions'
import * as carts from './carts'
import * as catalog from './catalog'
import * as catalogImport from './imports'
import * as coupons from './coupons'
import * as customers from './customers'
import * as devices from './devices'
import * as errors from './errors'
import * as giftCards from './gift-cards'
import * as money from './money'
import * as orders from './orders'
import * as payments from './payments'
import * as products from './products'
import * as register from './register'
import * as releases from './releases'
import * as receipts from './receipts'
import * as shippings from './shippings'
import * as tax from './tax'
import * as waitlists from './waitlists'
import * as restaurant from './waitlists/restaurant'

type AuctionsModule = typeof auctions
type CartsModule = typeof carts
type CatalogModule = typeof catalog
type RegisterModule = typeof register
type ReleasesModule = typeof releases
type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type ErrorsModule = typeof errors
type ShippingsModule = typeof shippings
type GiftCardsModule = typeof giftCards
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ProductsModule = typeof products
type RestaurantModule = typeof restaurant
type TaxModule = typeof tax
type WaitlistsModule = typeof waitlists
type DevicesModule = typeof devices
type ReceiptsModule = typeof receipts

export interface CommerceNamespace {
  /** Benefit auctions: lots, proxy bidding, anti-snipe, pledges, settlement. */
  auctions: AuctionsModule
  /** Shopping carts: the pre-order basket a customer builds before checkout. */
  carts: CartsModule
  /** A catalog's order (category, name, sizes small to large), search and low stock. */
  catalog: CatalogModule
  coupons: CouponsModule
  customers: CustomersModule
  errors: ErrorsModule
  giftCards: GiftCardsModule
  orders: OrdersModule
  payments: PaymentsModule
  products: ProductsModule
  /** A point-of-sale register's basket, held against the stock on the shelf. */
  register: RegisterModule
  /** When each part of a digital product opens for a buyer: all at once, a drip, or a schedule. */
  releases: ReleasesModule
  restaurant: RestaurantModule
  shippings: ShippingsModule
  tax: TaxModule
  waitlists: WaitlistsModule
  devices: DevicesModule
  receipts: ReceiptsModule
}

export const commerce: CommerceNamespace = {
  auctions,
  carts,
  catalog,
  coupons,
  customers,
  devices,
  errors,
  giftCards,
  orders,
  payments,
  products,
  receipts,
  register,
  releases,
  restaurant,
  shippings,
  tax,
  waitlists,
}

export default commerce

// Catalog import (Shopify, WooCommerce) is a tool rather than a store module,
// so it is exported beside the namespace rather than inside it.
export {
  auctions,
  carts,
  catalog,
  catalogImport,
  coupons,
  customers,
  devices,
  errors,
  giftCards,
  money,
  orders,
  payments,
  products,
  receipts,
  register,
  releases,
  restaurant,
  shippings,
  tax,
  waitlists,
}

// Money conversion at the display and input boundary: stored amounts are
// integer minor units everywhere (stacksjs/stacks#2851). Browser code imports
// the same functions from `@stacksjs/commerce/money`, which pulls in nothing else.
export {
  currencyExponent,
  decimalToMinor,
  formatCurrency,
  formatMinor,
  minorToDecimal,
  minorToInput,
  minorToMajor,
  moneyInputError,
  moneyInputStep,
  parseMoneyInput,
  PriceFormatError,
} from './money'
export type { MoneyInputOptions } from './money'

// Itemised sales tax on an amount: pure, so a register shows it before it
// charges. Browser code imports it from `@stacksjs/commerce/sales-tax`.
export { breakdownFor, multiplierOf } from './sales-tax'
export type { TaxRateRow } from './sales-tax'
