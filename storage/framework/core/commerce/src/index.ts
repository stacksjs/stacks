// Main ecommerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as devices from './devices'
import * as giftCards from './gift-cards'
import * as orders from './orders'
import * as payments from './payments'
import * as products from './products'
import * as rates from './rates'
import * as receipts from './receipts'
import * as restaurant from './restaurant'
import * as shippings from './shippings'
import * as tax from './tax'
import * as waitlist from './waitlist'

type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type ShippingsModule = typeof shippings
type GiftCardsModule = typeof giftCards
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ProductsModule = typeof products
type RestaurantModule = typeof restaurant
type RatesModule = typeof rates
type TaxModule = typeof tax
type WaitlistModule = typeof waitlist
type DevicesModule = typeof devices
type ReceiptsModule = typeof receipts

export interface EcommerceNamespace {
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  orders: OrdersModule
  payments: PaymentsModule
  products: ProductsModule
  restaurant: RestaurantModule
  rates: RatesModule
  shippings: ShippingsModule
  tax: TaxModule
  waitlist: WaitlistModule
  devices: DevicesModule
  receipts: ReceiptsModule
}

export const ecommerce: EcommerceNamespace = {
  coupons,
  customers,
  devices,
  giftCards,
  orders,
  payments,
  products,
  rates,
  receipts,
  restaurant,
  shippings,
  tax,
  waitlist,
}

export default ecommerce

export {
  coupons,
  customers,
  devices,
  giftCards,
  orders,
  payments,
  products,
  rates,
  receipts,
  restaurant,
  shippings,
  tax,
  waitlist,
}
