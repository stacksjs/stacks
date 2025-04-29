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

export interface Categories {
  id: number
  name: string
  description?: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order: number
  uuid?: string

  created_at?: string

  updated_at?: string

}
export interface Units {
  id: number
  product_id: number
  name: string
  abbreviation: string
  type: string
  description?: string
  is_default?: boolean
  uuid?: string
  created_at?: string
  updated_at?: string
}

export interface ProductItems {
  id: number
  product_id: number
  manufacturer_id: number
  category_id: number
  name: string
  size?: string
  color?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  sku: string
  custom_options?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Reviews {
  id: number
  product_id: number
  customer_id: number
  rating: number
  title: string
  content: string
  is_verified_purchase?: boolean
  is_approved?: boolean
  is_featured?: boolean
  helpful_votes?: number
  unhelpful_votes?: number
  purchase_date?: string
  images?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface Drivers {
  id: number
  user_id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status?: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}
export interface DeliveryRoutes {
  id: number
  driver: string
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active?: Date | string
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface DigitalDeliveries {
  id: number
  name: string
  description: string
  download_limit?: number
  expiry_days: number
  requires_login?: boolean
  automatic_delivery?: boolean
  status?: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface ShippingMethods {
  id: number
  name: string
  description?: string
  base_rate: number
  free_shipping?: number
  status: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface ShippingRates {
  id: number
  method: string
  zone: string
  weight_from: number
  weight_to: number
  rate: number
  uuid?: string

  created_at?: string

  updated_at?: string
}

export interface ShippingZones {
  id: number
  shipping_method_id: number
  name: string
  countries?: string
  regions?: string
  postal_codes?: string
  status: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface ProductVariants {
  id: number
  product_id: number
  variant: string
  type: string
  description?: string
  options?: string
  status: string | string[]
  uuid?: string

  created_at?: string

  updated_at?: string

}