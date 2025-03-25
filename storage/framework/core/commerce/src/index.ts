// Main ecommerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as digital from './digital'
import * as drivers from './drivers'
import * as giftCards from './gift-cards'
import * as licenses from './license'
import * as manufacturer from './manufacturer'
import * as orders from './orders'
import * as payments from './payments'
import * as rates from './rates'
import * as reviews from './reviews'
import * as shipping from './shipping'
import * as unit from './unit'
import * as variants from './variants'
import * as zones from './zones'

type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type GiftCardsModule = typeof giftCards
type ManufacturerModule = typeof manufacturer
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ReviewsModule = typeof reviews
type UnitModule = typeof unit
type ShippingModule = typeof shipping
type RatesModule = typeof rates
type ZonesModule = typeof zones
type VariantsModule = typeof variants
type DriversModule = typeof drivers
type LicensesModule = typeof licenses
type DigitalModule = typeof digital
export interface EcommerceNamespace {
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  manufacturer: ManufacturerModule
  orders: OrdersModule
  drivers: DriversModule
  payments: PaymentsModule
  reviews: ReviewsModule
  shipping: ShippingModule
  rates: RatesModule
  zones: ZonesModule
  variants: VariantsModule
  unit: UnitModule
  licenses: LicensesModule
  digital: DigitalModule
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
  shipping,
  rates,
  zones,
  variants,
  licenses,
  unit,
  digital,
}

export default ecommerce

export {
  coupons,
  customers,
  digital,
  drivers,
  giftCards,
  licenses,
  manufacturer,
  orders,
  payments,
  rates,
  reviews,
  shipping,
  unit,
  variants,
  zones,
}
