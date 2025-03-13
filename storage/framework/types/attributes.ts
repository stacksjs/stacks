export interface Attributes {
  name: string
  description: string
  url: string
  status: string
  email: string
  token: string
  plain_text_token: string
  abilities: string | string[]
  last_used_at: Date | string
  expires_at: Date | string
  revoked_at: Date | string
  ip_address: string
  device_name: string
  is_single_use: boolean
  company_name: string
  billing_email: string
  path: string
  is_personal: boolean
  subscribed: boolean
  commit_sha: string
  commit_message: string
  branch: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  version: string
  job_title: string
  password: string
  title: string
  body: string
  amount: number
  method: string
  currency: string
  reference_number: string
  card_last_four: string
  card_brand: string
  transaction_id: string
  payment_provider: string
  refund_amount: number
  notes: string
  manufacturer: string
  country: string
  featured: boolean
  quantity: number
  price: number
  special_instructions: string
  phone: string
  total_spent: number
  last_order: string
  avatar: string
  rating: number
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  image_url: string
  is_available: boolean
  inventory_count: number
  category_id: string
  preparation_time: number
  allergens: string
  nutritional_info: string
  variant: string
  type: string
  options: string
  code: string
  initial_balance: number
  current_balance: number
  purchaser_id: string
  recipient_email: string
  recipient_name: string
  personal_message: string
  is_digital: boolean
  is_reloadable: boolean
  is_active: boolean
  expiry_date: Date | string
  last_used_date: Date | string
  template_id: string
  total_amount: number
  tax_amount: number
  discount_amount: number
  delivery_fee: number
  tip_amount: number
  order_type: string
  delivery_address: string
  estimated_delivery_time: string
  applied_coupon_id: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  free_product_id: string
  usage_limit: number
  usage_count: number
  start_date: Date | string
  end_date: Date | string
  applicable_products: string
  applicable_categories: string
  payment_method: string
  payment_details: string
  transaction_reference: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  wallet_id: string
  points: number
  source: string
  source_reference_id: string
  is_used: boolean
  size: string
  color: string
  sku: string
  custom_options: string
  points_required: number
  reward_type: string
  discount_percentage: number
  expiry_days: number
  parent_category_id: string
  display_order: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: Date | string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  status_code: number
  duration_ms: number
  memory_usage: number
  user_agent: string
  error_message: string
  attempts: number
  available_at: number
  reserved_at: Date | string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  trial_ends_at: string
  ends_at: string
  key: number
  image: string
  message: string
  stack: string
  additional_info: string
}
