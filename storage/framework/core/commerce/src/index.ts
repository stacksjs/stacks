// Main commerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as devices from './devices'
import * as giftCards from './gift-cards'
import * as orders from './orders'
import * as payments from './payments'
import * as products from './products'
import * as receipts from './receipts'
import * as shippings from './shippings'
import * as tax from './tax'
import * as waitlists from './waitlists'
import * as restaurant from './waitlists/restaurant'

type CouponsModule = typeof coupons
type CustomersModule = typeof customers
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
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  orders: OrdersModule
  payments: PaymentsModule
  products: ProductsModule
  restaurant: RestaurantModule
  shippings: ShippingsModule
  tax: TaxModule
  waitlists: WaitlistsModule
  devices: DevicesModule
  receipts: ReceiptsModule
}

export const commerce: CommerceNamespace = {
  coupons,
  customers,
  devices,
  giftCards,
  orders,
  payments,
  products,
  receipts,
  restaurant,
  shippings,
  tax,
  waitlists,
}

export default commerce

export {
  coupons,
  customers,
  devices,
  giftCards,
  orders,
  payments,
  products,
  receipts,
  restaurant,
  shippings,
  tax,
  waitlists,
}
