// Main ecommerce module index file
import * as coupons from './coupons'
import * as customers from './customers'
import * as giftCards from './gift-cards'
import * as manufacturer from './manufacturer'
import * as orders from './orders'
import * as payments from './payments'
import * as reviews from './reviews'

// Define types for each module
type CouponsModule = typeof coupons
type CustomersModule = typeof customers
type GiftCardsModule = typeof giftCards
type ManufacturerModule = typeof manufacturer
type OrdersModule = typeof orders
type PaymentsModule = typeof payments
type ReviewsModule = typeof reviews

// Define the ecommerce namespace interface
export interface EcommerceNamespace {
  coupons: CouponsModule
  customers: CustomersModule
  giftCards: GiftCardsModule
  manufacturer: ManufacturerModule
  orders: OrdersModule
  payments: PaymentsModule
  reviews: ReviewsModule
}

// Create the main ecommerce namespace object with explicit type
export const ecommerce: EcommerceNamespace = {
  coupons: coupons,
  customers: customers,
  giftCards: giftCards,
  manufacturer: manufacturer,
  orders: orders,
  payments: payments,
  reviews: reviews,
}

// Default export for easier import
export default ecommerce

// Also provide direct access to all submodules
export {
  coupons,
  customers,
  giftCards,
  manufacturer,
  orders,
  payments,
  reviews,
}