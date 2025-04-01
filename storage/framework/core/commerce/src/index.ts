// Main ecommerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as devices from './devices'
import * as digital from './digital'
import * as drivers from './drivers'
import * as giftCards from './gift-cards'
import * as licenses from './licenses'
import * as manufacturer from './manufacturer'
import * as orders from './orders'
import * as payments from './payments'
import * as rates from './rates'
import * as restaurant from './restaurant'
import * as reviews from './reviews'
import * as deliveryRoutes from './routes'
import * as shipping from './shipping'
import * as tax from './tax'
import * as unit from './unit'
import * as variants from './variants'
import * as waitlist from './waitlist'
import * as zones from './zones'

type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type GiftCardsModule = typeof giftCards
type ManufacturerModule = typeof manufacturer
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ReviewsModule = typeof reviews
type RestaurantModule = typeof restaurant
type UnitModule = typeof unit
type ShippingModule = typeof shipping
type RatesModule = typeof rates
type ZonesModule = typeof zones
type VariantsModule = typeof variants
type DriversModule = typeof drivers
type LicensesModule = typeof licenses
type DigitalModule = typeof digital
type TaxModule = typeof tax
type DeliveryRoutesModule = typeof deliveryRoutes
type WaitlistModule = typeof waitlist
type DevicesModule = typeof devices
export interface EcommerceNamespace {
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  manufacturer: ManufacturerModule
  orders: OrdersModule
  drivers: DriversModule
  payments: PaymentsModule
  reviews: ReviewsModule
  restaurant: RestaurantModule
  shipping: ShippingModule
  rates: RatesModule
  zones: ZonesModule
  variants: VariantsModule
  unit: UnitModule
  deliveryRoutes: DeliveryRoutesModule
  licenses: LicensesModule
  digital: DigitalModule
  tax: TaxModule
  waitlist: WaitlistModule
  devices: DevicesModule
}

export const ecommerce: EcommerceNamespace = {
  coupons,
  customers,
  giftCards,
  manufacturer,
  drivers,
  orders,
  payments,
  reviews,
  restaurant,
  shipping,
  deliveryRoutes,
  rates,
  zones,
  variants,
  licenses,
  unit,
  digital,
  devices,
  tax,
  waitlist,
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
  manufacturer,
  orders,
  payments,
  rates,
  restaurant,
  reviews,
  shipping,
  tax,
  unit,
  variants,
  waitlist,
  zones,
}
