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

export interface Items {
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

export interface Variants {
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