export interface Customers {
  id?: number
  user_id?: number
  name: string
  email: string
  phone: string
  total_spent?: number
  last_order?: string
  status: string | string[]
  avatar?: string
  uuid?: string
}

export interface Coupons {
  id?: number
  user_id?: number
  code: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  usage_limit: number
  usage_count: number
  start_date: string
  end_date: string
  status: string
  uuid?: string
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
}

export type StorePost = Omit<Posts, 'id' | 'uuid' | 'created_at' | 'updated_at' | 'views' | 'comments' | 'published' | 'featured'>

export interface Posts {
  id: number
  title: string
  categories?: string[]
  slug?: string
  tag_ids?: number[]
  author_name?: string
  author_email?: string
  category?: string
  poster?: string
  comments: number
  tags: string[]
  body?: string
  views: number
  category_ids?: number[]
  published_at?: number
  status?: string | string[]
  uuid?: string
  excerpt: string
  author: string
  published: string
  featured?: boolean
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

}

export interface ShippingMethods {
  id: number
  name: string
  description?: string
  base_rate: number
  free_shipping?: number
  status: string | string[]
  uuid?: string
}

export interface ShippingRates {
  id: number
  method: string
  zone: string
  weight_from: number
  weight_to: number
  rate: number
  uuid?: string
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
}

export interface Taggables {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  taggable_id: number
  taggable_type: string
  postCount: number
  created_at: string
  updated_at: string
}

export type PostTaggable = Omit<Taggables, 'taggable_id' | 'taggable_type' | 'is_active'>

export interface Categorizables {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  postCount: number
  categorizable_type: string
  created_at: string
}

export type PostCategorizable = Omit<Categorizables, 'categorizable_type' | 'is_active'>

export interface Pages {
  id: number
  title: string
  template: string
  views: number
  conversions: number
  author_id: number
  author_name: string
  author_email: string
  status: string | string[]
  uuid?: string
}

export interface Websockets {
  id: number
  type: string
  socket: string
  details: string
  time: number
  created_at?: string
  updated_at?: string
  uuid?: string
}

export interface WaitlistProduct {
  id: number
  name: string
  description: string
  price: number
  status: string
  created_at: Date
  updated_at: Date
}

export interface WaitlistRestaurant {
  id: number
  name: string
  description: string
  address: string
  status: string
  created_at: Date
  updated_at: Date
}

export type StoreWebsocket = Omit<Websockets, 'id' | 'uuid' | 'created_at' | 'updated_at'>
