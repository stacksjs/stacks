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
  created_at?: Date
  updated_at?: Date
}
export interface ProjectRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataProject
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataSubscriberEmail {
  id: number
  email: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface SubscriberEmailRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataSubscriberEmail
  id: number
  email: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: Date
  updated_at?: Date
}
export interface AccessTokenRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataAccessToken
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface TeamRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataSubscriber {
  id: number
  subscribed: boolean
  user_id: number
  created_at?: Date
  updated_at?: Date
}
export interface SubscriberRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataSubscriber
  id: number
  subscribed: boolean
  user_id: number
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface DeploymentRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataRelease {
  id: number
  name: string
  version: string
  created_at?: Date
  updated_at?: Date
}
export interface ReleaseRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataRelease
  id: number
  name: string
  version: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataUser {
  id: number
  name: string
  email: string
  job_title: string
  password: string
  created_at?: Date
  updated_at?: Date
}
export interface UserRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataUser
  id: number
  name: string
  email: string
  job_title: string
  password: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataPost {
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
}
export interface PostRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataPost
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface PaymentRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataManufacturer {
  id: number
  manufacturer: string
  description: string
  country: string
  featured: boolean
  created_at?: Date
  updated_at?: Date
}
export interface ManufacturerRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataManufacturer
  id: number
  manufacturer: string
  description: string
  country: string
  featured: boolean
  created_at?: Date
  updated_at?: Date
}

interface RequestDataOrderItem {
  id: number
  quantity: number
  price: number
  special_instructions: string
  order_id: number
  created_at?: Date
  updated_at?: Date
}
export interface OrderItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataOrderItem
  id: number
  quantity: number
  price: number
  special_instructions: string
  order_id: number
  created_at?: Date
  updated_at?: Date
}

interface RequestDataCustomer {
  id: number
  name: string
  email: string
  phone: string
  total_spent: number
  last_order: string
  status: string[]
  avatar: string
  created_at?: Date
  updated_at?: Date
}
export interface CustomerRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataCustomer
  id: number
  name: string
  email: string
  phone: string
  total_spent: number
  last_order: string
  status: string[]
  avatar: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataProductReview {
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  created_at?: Date
  updated_at?: Date
}
export interface ProductReviewRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataProductReview
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataProduct {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  category_id: string
  preparation_time: number
  allergens: string
  nutritional_info: string
  manufacturer_id: number
  product_category_id: number
  created_at?: Date
  updated_at?: Date
}
export interface ProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataProduct
  id: number
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  category_id: string
  preparation_time: number
  allergens: string
  nutritional_info: string
  manufacturer_id: number
  product_category_id: number
  created_at?: Date
  updated_at?: Date
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
  expiry_date: date
  last_used_date: date
  template_id: string
  created_at?: Date
  updated_at?: Date
}
export interface GiftCardRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  expiry_date: date
  last_used_date: date
  template_id: string
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface OrderRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface CouponRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface TransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataTransaction
  id: number
  amount: number
  status: string
  payment_method: string
  payment_details: string
  transaction_reference: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface LoyaltyPointRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataLoyaltyPoint
  id: number
  wallet_id: string
  points: number
  source: string
  source_reference_id: string
  description: string
  expiry_date: string
  is_used: boolean
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface ProductItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface LoyaltyRewardRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataProductCategory {
  id: number
  name: string
  description: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: Date
  updated_at?: Date
}
export interface ProductCategoryRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataProductCategory
  id: number
  name: string
  description: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: Date
  updated_at?: Date
}

interface RequestDataFailedJob {
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: Date
  updated_at?: Date
}
export interface FailedJobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataFailedJob
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface PaymentMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
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
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface PaymentTransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataPaymentTransaction
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  user_id: number
  payment_method_id: number
  created_at?: Date
  updated_at?: Date
}

interface RequestDataRequest {
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface RequestRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataRequest
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataJob {
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: Date
  updated_at?: Date
}
export interface JobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataJob
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataSubscription {
  id: number
  type: string
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
  created_at?: Date
  updated_at?: Date
}
export interface SubscriptionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataSubscription
  id: number
  type: string
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
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface PaymentProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataPaymentProduct
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataError {
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: Date
  updated_at?: Date
}
export interface ErrorRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(key: string, defaultValue?: T) => T
  all: () => RequestDataError
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: Date
  updated_at?: Date
}

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestType | PaymentRequestType | ManufacturerRequestType | OrderItemRequestType | CustomerRequestType | ProductReviewRequestType | ProductRequestType | GiftCardRequestType | OrderRequestType | CouponRequestType | TransactionRequestType | LoyaltyPointRequestType | ProductItemRequestType | LoyaltyRewardRequestType | ProductCategoryRequestType | FailedJobRequestType | PaymentMethodRequestType | PaymentTransactionRequestType | RequestRequestType | JobRequestType | SubscriptionRequestType | PaymentProductRequestType | ErrorRequestType
