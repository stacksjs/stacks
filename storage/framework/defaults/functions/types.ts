export interface Customers {
  id: number
  user_id: number
  name: string
  email: string
  phone: string
  total_spent?: number
  last_order?: string
  status: string | string[]
  avatar?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Coupons {
  id: number
  product_id: number
  code: string
  description?: string
  discount_type: string
  discount_value: number
  min_order_amount?: number
  max_discount_amount?: number
  free_product_id?: string
  is_active?: boolean
  usage_limit?: number
  usage_count?: number
  start_date: Date | string
  end_date: Date | string
  applicable_products?: string
  applicable_categories?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface GiftCards {
  id: number
  customer_id: number
  code: string
  initial_balance: number
  current_balance: number
  currency?: string
  status: string
  purchaser_id?: string
  recipient_email?: string
  recipient_name?: string
  personal_message?: string
  is_digital?: boolean
  is_reloadable?: boolean
  is_active?: boolean
  expiry_date?: number
  last_used_date?: number
  template_id?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Orders {
  id: number
  customer_id: number
  coupon_id: number
  status: string
  total_amount: number
  tax_amount?: number
  discount_amount?: number
  delivery_fee?: number
  tip_amount?: number
  order_type: string
  delivery_address?: string
  special_instructions?: string
  estimated_delivery_time?: string
  applied_coupon_id?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Posts {
  id: number
  author_id: number
  title: string
  category: string
  poster?: string
  body: string
  views?: number
  published_at: number
  status: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Payments {
  id: number
  order_id: number
  customer_id: number
  amount: number
  method: string
  status: string
  currency?: string
  reference_number?: string
  card_last_four?: string
  card_brand?: string
  billing_email?: string
  transaction_id?: string
  payment_provider?: string
  refund_amount?: number
  notes?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface TaxRates {
  id: number
  name: string
  rate: number
  type: string
  country: string
  region: string | string[]
  status?: string | string[]
  is_default?: boolean
  uuid?: string

  created_at?: string

  updated_at?: string

}
