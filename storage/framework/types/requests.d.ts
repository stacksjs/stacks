import type { VineType } from '@stacksjs/types'
import type { Request } from '../core/router/src/request'

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

interface RequestDataProject {
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: string
  updated_at?: string
}
export interface ProjectRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataProject
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: string
  updated_at?: string
}

interface RequestDataSubscriberEmail {
  id: number
  email: string
  deleted_at?: string
  created_at?: string
  updated_at?: string
}
export interface SubscriberEmailRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataSubscriberEmail
  id: number
  email: string
  deleted_at?: string
  created_at?: string
  updated_at?: string
}

interface RequestDataAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[] | string
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: string
  updated_at?: string
}
export interface AccessTokenRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataAccessToken
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[] | string
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataTeam {
  id: number
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface TeamRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataTeam
  id: number
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataSubscriber {
  id: number
  subscribed: boolean
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface SubscriberRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataSubscriber
  id: number
  subscribed: boolean
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataDeployment {
  id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface DeploymentRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataDeployment
  id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataRelease {
  id: number
  name: string
  version: string
  created_at?: string
  updated_at?: string
}
export interface ReleaseRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataRelease
  id: number
  name: string
  version: string
  created_at?: string
  updated_at?: string
}

interface RequestDataUser {
  id: number
  name: string
  email: string
  job_title: string
  password: string
  team_id: number
  created_at?: string
  updated_at?: string
}
export interface UserRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataUser
  id: number
  name: string
  email: string
  job_title: string
  password: string
  team_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataPaymentProduct {
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: string
  updated_at?: string
}
export interface PaymentProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPaymentProduct
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: string
  updated_at?: string
}

interface RequestDataPrintDevice {
  id: number
  name: string
  mac_address: string
  location: string
  terminal: string
  status: string[] | string
  last_ping: number
  print_count: number
  created_at?: string
  updated_at?: string
}
export interface PrintDeviceRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPrintDevice
  id: number
  name: string
  mac_address: string
  location: string
  terminal: string
  status: string[] | string
  last_ping: number
  print_count: number
  created_at?: string
  updated_at?: string
}

interface RequestDataCategory {
  id: number
  name: string
  description: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: string
  updated_at?: string
}
export interface CategoryRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCategory
  id: number
  name: string
  description: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: string
  updated_at?: string
}

interface RequestDataPayment {
  id: number
  amount: number
  method: string
  status: string
  currency: string
  reference_number: string
  card_last_four: string
  card_brand: string
  billing_email: string
  transaction_id: string
  payment_provider: string
  refund_amount: number
  notes: string
  customer_id: number
  order_id: number
  created_at?: string
  updated_at?: string
}
export interface PaymentRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPayment
  id: number
  amount: number
  method: string
  status: string
  currency: string
  reference_number: string
  card_last_four: string
  card_brand: string
  billing_email: string
  transaction_id: string
  payment_provider: string
  refund_amount: number
  notes: string
  customer_id: number
  order_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataDriver {
  id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status: string[] | string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface DriverRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataDriver
  id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status: string[] | string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataWaitlistProduct {
  id: number
  name: string
  email: string
  phone: string
  quantity: number
  notification_preference: string[] | string
  source: string
  notes: string
  status: string[] | string
  notified_at: number
  purchased_at: number
  cancelled_at: number
  customer_id: number
  product_id: number
  created_at?: string
  updated_at?: string
}
export interface WaitlistProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataWaitlistProduct
  id: number
  name: string
  email: string
  phone: string
  quantity: number
  notification_preference: string[] | string
  source: string
  notes: string
  status: string[] | string
  notified_at: number
  purchased_at: number
  cancelled_at: number
  customer_id: number
  product_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataDigitalDelivery {
  id: number
  name: string
  description: string
  download_limit: number
  expiry_days: number
  requires_login: boolean
  automatic_delivery: boolean
  status: string[] | string
  created_at?: string
  updated_at?: string
}
export interface DigitalDeliveryRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataDigitalDelivery
  id: number
  name: string
  description: string
  download_limit: number
  expiry_days: number
  requires_login: boolean
  automatic_delivery: boolean
  status: string[] | string
  created_at?: string
  updated_at?: string
}

interface RequestDataManufacturer {
  id: number
  manufacturer: string
  description: string
  country: string
  featured: boolean
  created_at?: string
  updated_at?: string
}
export interface ManufacturerRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataManufacturer
  id: number
  manufacturer: string
  description: string
  country: string
  featured: boolean
  created_at?: string
  updated_at?: string
}

interface RequestDataOrderItem {
  id: number
  quantity: number
  price: number
  special_instructions: string
  order_id: number
  created_at?: string
  updated_at?: string
}
export interface OrderItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataOrderItem
  id: number
  quantity: number
  price: number
  special_instructions: string
  order_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataShippingZone {
  id: number
  name: string
  countries: string
  regions: string
  postal_codes: string
  status: string[] | string
  shipping_method_id: number
  created_at?: string
  updated_at?: string
}
export interface ShippingZoneRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataShippingZone
  id: number
  name: string
  countries: string
  regions: string
  postal_codes: string
  status: string[] | string
  shipping_method_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataCustomer {
  id: number
  name: string
  email: string
  phone: string
  total_spent: number
  last_order: string
  status: string[] | string
  avatar: string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface CustomerRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCustomer
  id: number
  name: string
  email: string
  phone: string
  total_spent: number
  last_order: string
  status: string[] | string
  avatar: string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataProduct {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  preparation_time: number
  allergens: string
  nutritional_info: string
  category_id: number
  manufacturer_id: number
  created_at?: string
  updated_at?: string
}
export interface ProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataProduct
  id: number
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  preparation_time: number
  allergens: string
  nutritional_info: string
  category_id: number
  manufacturer_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataReceipt {
  id: number
  printer: string
  document: string
  timestamp: number
  status: string[] | string
  size: number
  pages: number
  duration: number
  metadata: string
  print_device_id: number
  created_at?: string
  updated_at?: string
}
export interface ReceiptRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataReceipt
  id: number
  printer: string
  document: string
  timestamp: number
  status: string[] | string
  size: number
  pages: number
  duration: number
  metadata: string
  print_device_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataProductVariant {
  id: number
  variant: string
  type: string
  description: string
  options: string
  status: string[] | string
  product_id: number
  created_at?: string
  updated_at?: string
}
export interface ProductVariantRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataProductVariant
  id: number
  variant: string
  type: string
  description: string
  options: string
  status: string[] | string
  product_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataLicenseKey {
  id: number
  key: string
  template: string[] | string
  expiry_date: date
  status: string[] | string
  customer_id: number
  product_id: number
  order_id: number
  created_at?: string
  updated_at?: string
}
export interface LicenseKeyRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataLicenseKey
  id: number
  key: string
  template: string[] | string
  expiry_date: date
  status: string[] | string
  customer_id: number
  product_id: number
  order_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataWaitlistRestaurant {
  id: number
  name: string
  email: string
  phone: string
  party_size: number
  check_in_time: number
  table_preference: string[] | string
  status: string[] | string
  quoted_wait_time: number
  actual_wait_time: number
  queue_position: number
  seated_at: number
  no_show_at: number
  cancelled_at: number
  customer_id: number
  created_at?: string
  updated_at?: string
}
export interface WaitlistRestaurantRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataWaitlistRestaurant
  id: number
  name: string
  email: string
  phone: string
  party_size: number
  check_in_time: number
  table_preference: string[] | string
  status: string[] | string
  quoted_wait_time: number
  actual_wait_time: number
  queue_position: number
  seated_at: number
  no_show_at: number
  cancelled_at: number
  customer_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataReview {
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  is_featured: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  customer_id: number
  product_id: number
  created_at?: string
  updated_at?: string
}
export interface ReviewRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataReview
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  is_featured: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  customer_id: number
  product_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataProductUnit {
  id: number
  name: string
  abbreviation: string
  type: string
  description: string
  is_default: boolean
  product_id: number
  created_at?: string
  updated_at?: string
}
export interface ProductUnitRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataProductUnit
  id: number
  name: string
  abbreviation: string
  type: string
  description: string
  is_default: boolean
  product_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataGiftCard {
  id: number
  code: string
  initial_balance: number
  current_balance: number
  currency: string
  status: string
  purchaser_id: string
  recipient_email: string
  recipient_name: string
  personal_message: string
  is_digital: boolean
  is_reloadable: boolean
  is_active: boolean
  expiry_date: number
  last_used_date: number
  template_id: string
  customer_id: number
  created_at?: string
  updated_at?: string
}
export interface GiftCardRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataGiftCard
  id: number
  code: string
  initial_balance: number
  current_balance: number
  currency: string
  status: string
  purchaser_id: string
  recipient_email: string
  recipient_name: string
  personal_message: string
  is_digital: boolean
  is_reloadable: boolean
  is_active: boolean
  expiry_date: number
  last_used_date: number
  template_id: string
  customer_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataOrder {
  id: number
  status: string
  total_amount: number
  tax_amount: number
  discount_amount: number
  delivery_fee: number
  tip_amount: number
  order_type: string
  delivery_address: string
  special_instructions: string
  estimated_delivery_time: string
  applied_coupon_id: string
  customer_id: number
  gift_card_id: number
  coupon_id: number
  created_at?: string
  updated_at?: string
}
export interface OrderRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataOrder
  id: number
  status: string
  total_amount: number
  tax_amount: number
  discount_amount: number
  delivery_fee: number
  tip_amount: number
  order_type: string
  delivery_address: string
  special_instructions: string
  estimated_delivery_time: string
  applied_coupon_id: string
  customer_id: number
  gift_card_id: number
  coupon_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataCoupon {
  id: number
  code: string
  description: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  free_product_id: string
  is_active: boolean
  usage_limit: number
  usage_count: number
  start_date: date
  end_date: date
  applicable_products: string
  applicable_categories: string
  product_id: number
  created_at?: string
  updated_at?: string
}
export interface CouponRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCoupon
  id: number
  code: string
  description: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  free_product_id: string
  is_active: boolean
  usage_limit: number
  usage_count: number
  start_date: date
  end_date: date
  applicable_products: string
  applicable_categories: string
  product_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataTaxRate {
  id: number
  name: string
  rate: number
  type: string
  country: string
  region: string[] | string
  status: string[] | string
  is_default: boolean
  created_at?: string
  updated_at?: string
}
export interface TaxRateRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataTaxRate
  id: number
  name: string
  rate: number
  type: string
  country: string
  region: string[] | string
  status: string[] | string
  is_default: boolean
  created_at?: string
  updated_at?: string
}

interface RequestDataTransaction {
  id: number
  amount: number
  status: string
  payment_method: string
  payment_details: string
  transaction_reference: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  created_at?: string
  updated_at?: string
}
export interface TransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataTransaction
  id: number
  amount: number
  status: string
  payment_method: string
  payment_details: string
  transaction_reference: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  created_at?: string
  updated_at?: string
}

interface RequestDataLoyaltyPoint {
  id: number
  wallet_id: string
  points: number
  source: string
  source_reference_id: string
  description: string
  expiry_date: string
  is_used: boolean
  created_at?: string
  updated_at?: string
}
export interface LoyaltyPointRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataLoyaltyPoint
  id: number
  wallet_id: string
  points: number
  source: string
  source_reference_id: string
  description: string
  expiry_date: string
  is_used: boolean
  created_at?: string
  updated_at?: string
}

interface RequestDataProductItem {
  id: number
  name: string
  size: string
  color: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  sku: string
  custom_options: string
  created_at?: string
  updated_at?: string
}
export interface ProductItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataProductItem
  id: number
  name: string
  size: string
  color: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  sku: string
  custom_options: string
  created_at?: string
  updated_at?: string
}

interface RequestDataLoyaltyReward {
  id: number
  name: string
  description: string
  points_required: number
  reward_type: string
  discount_percentage: number
  free_product_id: string
  is_active: boolean
  expiry_days: number
  image_url: string
  created_at?: string
  updated_at?: string
}
export interface LoyaltyRewardRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataLoyaltyReward
  id: number
  name: string
  description: string
  points_required: number
  reward_type: string
  discount_percentage: number
  free_product_id: string
  is_active: boolean
  expiry_days: number
  image_url: string
  created_at?: string
  updated_at?: string
}

interface RequestDataShippingMethod {
  id: number
  name: string
  description: string
  base_rate: number
  free_shipping: number
  status: string[] | string
  created_at?: string
  updated_at?: string
}
export interface ShippingMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataShippingMethod
  id: number
  name: string
  description: string
  base_rate: number
  free_shipping: number
  status: string[] | string
  created_at?: string
  updated_at?: string
}

interface RequestDataShippingRate {
  id: number
  method: string
  zone: string
  weight_from: number
  weight_to: number
  rate: number
  created_at?: string
  updated_at?: string
}
export interface ShippingRateRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataShippingRate
  id: number
  method: string
  zone: string
  weight_from: number
  weight_to: number
  rate: number
  created_at?: string
  updated_at?: string
}

interface RequestDataCart {
  id: number
  status: string[] | string
  total_items: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  expires_at: string
  currency: string
  notes: string
  applied_coupon_id: string
  created_at?: string
  updated_at?: string
}
export interface CartRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCart
  id: number
  status: string[] | string
  total_items: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  expires_at: string
  currency: string
  notes: string
  applied_coupon_id: string
  created_at?: string
  updated_at?: string
}

interface RequestDataDeliveryRoute {
  id: number
  driver: string
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active: date
  driver_id: number
  created_at?: string
  updated_at?: string
}
export interface DeliveryRouteRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataDeliveryRoute
  id: number
  driver: string
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active: date
  driver_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataCartItem {
  id: number
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
  tax_amount: number
  discount_percentage: number
  discount_amount: number
  product_name: string
  product_sku: string
  product_image: string
  notes: string
  cart_id: number
  created_at?: string
  updated_at?: string
}
export interface CartItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCartItem
  id: number
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
  tax_amount: number
  discount_percentage: number
  discount_amount: number
  product_name: string
  product_sku: string
  product_image: string
  notes: string
  cart_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataFailedJob {
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: string
  updated_at?: string
}
export interface FailedJobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataFailedJob
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: string
  updated_at?: string
}

interface RequestDataPaymentMethod {
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface PaymentMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPaymentMethod
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataPost {
  id: number
  title: string
  author: string
  category: string
  poster: string
  body: string
  views: number
  published_at: number
  status: string[] | string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface PostRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPost
  id: number
  title: string
  author: string
  category: string
  poster: string
  body: string
  views: number
  published_at: number
  status: string[] | string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataPaymentTransaction {
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  user_id: number
  payment_method_id: number
  created_at?: string
  updated_at?: string
}
export interface PaymentTransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPaymentTransaction
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  user_id: number
  payment_method_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataRequest {
  id: number
  method: string[] | string
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: string
  created_at?: string
  updated_at?: string
}
export interface RequestRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataRequest
  id: number
  method: string[] | string
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: string
  created_at?: string
  updated_at?: string
}

interface RequestDataJob {
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: string
  updated_at?: string
}
export interface JobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataJob
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: string
  updated_at?: string
}

interface RequestDataLog {
  id: number
  timestamp: number
  type: string[] | string
  source: string[] | string
  message: string
  project: string
  stacktrace: string
  file: string
  created_at?: string
  updated_at?: string
}
export interface LogRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataLog
  id: number
  timestamp: number
  type: string[] | string
  source: string[] | string
  message: string
  project: string
  stacktrace: string
  file: string
  created_at?: string
  updated_at?: string
}

interface RequestDataSubscription {
  id: number
  type: string
  plan: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: string
  updated_at?: string
}
export interface SubscriptionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataSubscription
  id: number
  type: string
  plan: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: string
  updated_at?: string
}

interface RequestDataError {
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: string
  updated_at?: string
}
export interface ErrorRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataError
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: string
  updated_at?: string
}

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PaymentProductRequestType | PrintDeviceRequestType | CategoryRequestType | PaymentRequestType | DriverRequestType | WaitlistProductRequestType | DigitalDeliveryRequestType | ManufacturerRequestType | OrderItemRequestType | ShippingZoneRequestType | CustomerRequestType | ProductRequestType | ReceiptRequestType | ProductVariantRequestType | LicenseKeyRequestType | WaitlistRestaurantRequestType | ReviewRequestType | ProductUnitRequestType | GiftCardRequestType | OrderRequestType | CouponRequestType | TaxRateRequestType | TransactionRequestType | LoyaltyPointRequestType | ProductItemRequestType | LoyaltyRewardRequestType | ShippingMethodRequestType | ShippingRateRequestType | CartRequestType | DeliveryRouteRequestType | CartItemRequestType | FailedJobRequestType | PaymentMethodRequestType | PostRequestType | PaymentTransactionRequestType | RequestRequestType | JobRequestType | LogRequestType | SubscriptionRequestType | ErrorRequestType
