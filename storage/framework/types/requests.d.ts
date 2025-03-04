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
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'url' | 'status') => string)

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
  get: ((key: 'id') => number) & ((key: 'email') => string)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'token' | 'plain_text_token' | 'ip_address' | 'device_name') => string) & ((key: 'abilities') => string[]) & ((key: 'last_used_at' | 'expires_at' | 'revoked_at') => date) & ((key: 'is_single_use') => boolean) & ((key: 'team_id') => string)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'company_name' | 'email' | 'billing_email' | 'status' | 'description' | 'path') => string) & ((key: 'is_personal') => boolean)

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
  get: ((key: 'id') => number) & ((key: 'subscribed') => boolean) & ((key: 'user_id') => string)

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
  get: ((key: 'id') => number) & ((key: 'commit_sha' | 'commit_message' | 'branch' | 'status' | 'deploy_script' | 'terminal_output') => string) & ((key: 'execution_time') => number) & ((key: 'user_id') => string)

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
  version: string
  created_at?: Date
  updated_at?: Date
}
export interface ReleaseRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'version') => string)

  all: () => RequestDataRelease
  id: number
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
  get: ((key: 'id') => number) & ((key: 'name' | 'email' | 'job_title' | 'password') => string)

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
  get: ((key: 'id') => number) & ((key: 'title' | 'body') => string) & ((key: 'user_id') => string)

  all: () => RequestDataPost
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
}

interface RequestDataOrderItem {
  id: number
  quantity: number
  price: number
  special_instructions: string
  created_at?: Date
  updated_at?: Date
}
export interface OrderItemRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'quantity' | 'price') => number) & ((key: 'special_instructions') => string)

  all: () => RequestDataOrderItem
  id: number
  quantity: number
  price: number
  special_instructions: string
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
  get: ((key: 'id') => number) & ((key: 'connection' | 'queue' | 'payload' | 'exception') => string) & ((key: 'failed_at') => date)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'email' | 'phone' | 'last_order' | 'avatar') => string) & ((key: 'total_spent') => number) & ((key: 'status') => string[])

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
  product_category_id: number
  created_at?: Date
  updated_at?: Date
}
export interface ProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'image_url' | 'category_id' | 'allergens' | 'nutritional_info') => string) & ((key: 'price' | 'inventory_count' | 'preparation_time') => number) & ((key: 'is_available') => boolean) & ((key: 'product_category_id') => string)

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
  product_category_id: number
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
  get: ((key: 'id') => number) & ((key: 'type' | 'brand' | 'provider_id') => string) & ((key: 'last_four' | 'exp_month' | 'exp_year') => number) & ((key: 'is_default') => boolean) & ((key: 'user_id') => string)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'type' | 'provider_id') => string) & ((key: 'amount') => number) & ((key: 'user_id') => string) & ((key: 'payment_method_id') => string)

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
  get: ((key: 'id') => number) & ((key: 'method') => string[]) & ((key: 'path' | 'ip_address' | 'user_agent' | 'error_message') => string) & ((key: 'status_code' | 'duration_ms' | 'memory_usage') => number)

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
  expiry_date: string
  last_used_date: string
  template_id: string
  created_at?: Date
  updated_at?: Date
}
export interface GiftCardRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'code' | 'currency' | 'status' | 'purchaser_id' | 'recipient_email' | 'recipient_name' | 'personal_message' | 'expiry_date' | 'last_used_date' | 'template_id') => string) & ((key: 'initial_balance' | 'current_balance') => number) & ((key: 'is_digital' | 'is_reloadable' | 'is_active') => boolean)

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
  expiry_date: string
  last_used_date: string
  template_id: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataOrder {
  id: number
  customer_id: string
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
  order_items: string
  customer_id: number
  gift_card_id: number
  coupon_id: number
  created_at?: Date
  updated_at?: Date
}
export interface OrderRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'customer_id' | 'status' | 'order_type' | 'delivery_address' | 'special_instructions' | 'estimated_delivery_time' | 'applied_coupon_id' | 'order_items') => string) & ((key: 'total_amount' | 'tax_amount' | 'discount_amount' | 'delivery_fee' | 'tip_amount') => number) & ((key: 'customer_id') => string) & ((key: 'gift_card_id') => string) & ((key: 'coupon_id') => string)

  all: () => RequestDataOrder
  id: number
  customer_id: string
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
  order_items: string
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
  start_date: string
  end_date: string
  applicable_products: string
  applicable_categories: string
  created_at?: Date
  updated_at?: Date
}
export interface CouponRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'code' | 'description' | 'discount_type' | 'free_product_id' | 'start_date' | 'end_date' | 'applicable_products' | 'applicable_categories') => string) & ((key: 'discount_value' | 'min_order_amount' | 'max_discount_amount' | 'usage_limit' | 'usage_count') => number) & ((key: 'is_active') => boolean)

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
  start_date: string
  end_date: string
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
  get: ((key: 'id') => number) & ((key: 'amount' | 'loyalty_points_earned' | 'loyalty_points_redeemed') => number) & ((key: 'status' | 'payment_method' | 'payment_details' | 'transaction_reference') => string)

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
  get: ((key: 'id') => number) & ((key: 'wallet_id' | 'source' | 'source_reference_id' | 'description' | 'expiry_date') => string) & ((key: 'points') => number) & ((key: 'is_used') => boolean)

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
  get: ((key: 'id') => number) & ((key: 'queue' | 'payload') => string) & ((key: 'attempts' | 'available_at') => number) & ((key: 'reserved_at') => date)

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
  get: ((key: 'id') => number) & ((key: 'type' | 'provider_id' | 'provider_status' | 'provider_type' | 'provider_price_id' | 'trial_ends_at' | 'ends_at' | 'last_used_at') => string) & ((key: 'unit_price' | 'quantity') => number) & ((key: 'user_id') => string)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'status' | 'image' | 'provider_id') => string) & ((key: 'description' | 'key' | 'unit_price') => number)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'reward_type' | 'free_product_id' | 'image_url') => string) & ((key: 'points_required' | 'discount_percentage' | 'expiry_days') => number) & ((key: 'is_active') => boolean)

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
  get: ((key: 'id') => number) & ((key: 'type' | 'message' | 'stack' | 'additional_info') => string) & ((key: 'status') => number)

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
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'image_url' | 'parent_category_id') => string) & ((key: 'is_active') => boolean) & ((key: 'display_order') => number)

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

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestType | OrderItemRequestType | FailedJobRequestType | CustomerRequestType | ProductRequestType | PaymentMethodRequestType | PaymentTransactionRequestType | RequestRequestType | GiftCardRequestType | OrderRequestType | CouponRequestType | TransactionRequestType | LoyaltyPointRequestType | JobRequestType | SubscriptionRequestType | PaymentProductRequestType | LoyaltyRewardRequestType | ErrorRequestType | ProductCategoryRequestType
