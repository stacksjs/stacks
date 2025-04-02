// Main ecommerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as devices from './devices'
import * as digital from './digital'
import * as drivers from './drivers'
import * as giftCards from './gift-cards'
import * as licenses from './licenses'
import * as orders from './orders'
import * as payments from './payments'
import * as products from './products'
import * as rates from './rates'
import * as receipts from './receipts'
import * as restaurant from './restaurant'
import * as deliveryRoutes from './routes'
import * as shipping from './shipping'
import * as tax from './tax'
import * as waitlist from './waitlist'
import * as zones from './zones'

type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type GiftCardsModule = typeof giftCards
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ProductsModule = typeof products
type RestaurantModule = typeof restaurant
type ShippingModule = typeof shipping
type RatesModule = typeof rates
type ZonesModule = typeof zones
type DriversModule = typeof drivers
type LicensesModule = typeof licenses
type DigitalModule = typeof digital
type TaxModule = typeof tax
type DeliveryRoutesModule = typeof deliveryRoutes
type WaitlistModule = typeof waitlist
type DevicesModule = typeof devices
type ReceiptsModule = typeof receipts

export interface EcommerceNamespace {
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  orders: OrdersModule
  drivers: DriversModule
  payments: PaymentsModule
  products: ProductsModule
  restaurant: RestaurantModule
  shipping: ShippingModule
  rates: RatesModule
  zones: ZonesModule
  deliveryRoutes: DeliveryRoutesModule
  licenses: LicensesModule
  digital: DigitalModule
  tax: TaxModule
  waitlist: WaitlistModule
  devices: DevicesModule
  receipts: ReceiptsModule
}

export const ecommerce: EcommerceNamespace = {
  coupons,
  customers,
  giftCards,
  drivers,
  orders,
  payments,
  products,
  restaurant,
  shipping,
  deliveryRoutes,
  rates,
  zones,
  licenses,
  digital,
  devices,
  tax,
  waitlist,
  receipts,
}

export default ecommerce

export {
  coupons,
  customers,
  deliveryRoutes,
  devices,
  digital,
  drivers,
  giftCards,
  licenses,
  orders,
  payments,
  products,
  rates,
  receipts,
  restaurant,
  shipping,
  tax,
  waitlist,
  zones,
}
