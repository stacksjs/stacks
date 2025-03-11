import type { Insertable, Selectable, Updateable } from '@stacksjs/database'

import type { CouponModel } from '../../orm/src/models/Coupon'
// Import the CustomerTable type from the ORM
import type {
  CustomerJsonResponse,
  CustomerModel,
  CustomersTable,
  CustomerUpdate,
  NewCustomer,
} from '../../orm/src/models/Customer'
import type { GiftCardJsonResponse } from '../../orm/src/models/GiftCard'
import type { ManufacturerJsonResponse } from '../../orm/src/models/Manufacturer'
// Import the OrderTable type from the ORM
import type { OrderJsonResponse, OrdersTable } from '../../orm/src/models/Order'
import type { OrderItemModel } from '../../orm/src/models/OrderItem'
import type { ProductReviewJsonResponse } from '../../orm/src/models/ProductReview'

// Re-export the types
export type {
  CustomerJsonResponse,
  CustomersTable,
  CustomerUpdate,
  NewCustomer,
}

// Define response structure for paginated customers
export interface CustomerResponse {
  data: CustomerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

// Define the input for creating a customer
export interface CreateCustomerInput {
  name: string
  email: string
  phone: string
  orders?: number
  total_spent?: number // Changed from totalSpent to match the schema
  last_order?: string // Changed from lastOrder to match the schema
  status?: string
  avatar?: string
  user_id?: number
}

// Define the input for updating a customer
export interface UpdateCustomerInput {
  name?: string
  email?: string
  phone?: string
  orders?: number
  total_spent?: number // Changed from totalSpent to match the schema
  last_order?: string // Changed from lastOrder to match the schema
  status?: string
  avatar?: string
  user_id?: number
}

// Re-export the types for consistency
export type OrderTable = OrdersTable

// Define response structure for paginated orders
export interface OrderResponse {
  data: OrderJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type OrderType = Selectable<OrdersTable>
export type NewOrder = Insertable<OrdersTable>
export type OrderUpdate = Updateable<OrdersTable>

// Define the structure of an order item
export interface OrderItem {
  product_id: string
  quantity: number
  price: number
  special_instructions?: string
}

// Type for status count
export interface StatusCount {
  status: string
  count: number | string // Using string since SQL count might return as string
}

// Type for order type count
export interface OrderTypeCount {
  order_type: string
  count: number | string // Using string since SQL count might return as string
}

// Type for the stats return value
export interface OrderStats {
  total: number
  by_status: StatusCount[]
  by_type: OrderTypeCount[]
  recent: OrderType[]
  revenue: number
}

/**
 * Represents a simplified order item structure with required properties for total calculation
 */
export interface OrderItemForCalculation {
  price: number
  quantity: number
}

/**
 * Represents the totals calculated for an order
 */
export interface OrderTotals {
  subtotal: number
  tax_amount: number
  total_amount: number
}

/**
 * Represents statistics for a discount type
 */
export interface DiscountTypeCount {
  discount_type: string | undefined
  count: string | number | bigint
}

/**
 * Represents comprehensive coupon statistics
 */
export interface CouponStats {
  /** Total number of coupons in the system */
  total: number

  /** Number of currently active coupons */
  active: number

  /** Distribution of coupons by discount type */
  by_type: DiscountTypeCount[]

  /** List of most frequently used coupons */
  most_used: {
    id: number | undefined
    code: string | undefined
    discount_type: string | undefined
    discount_value: number | undefined
    usage_count: number | undefined
  }[]

  /** List of upcoming coupons that will be active soon */
  upcoming: {
    id: number | undefined
    code: string | undefined
    discount_type: string | undefined
    discount_value: number | undefined
    start_date: Date | string
    end_date: Date | string
  }[]
}
export interface OrderWithTotals {
  order_items: OrderItemModel[] | []
  id: number
  customer_id: number
  customer: CustomerModel | undefined
  coupon_id: number
  coupon: CouponModel | undefined
  status: string
  total_amount: number
  tax_amount: number | undefined
  discount_amount: number | undefined
  delivery_fee: number | undefined
  tip_amount: number | undefined
  order_type: string
  delivery_address: string | undefined
  special_instructions: string | undefined
  estimated_delivery_time: string | undefined
  applied_coupon_id: string | undefined
  uuid: string | undefined
  created_at: Date | undefined
  updated_at: Date | undefined
  customer_name: string | null
  customer_email: string | null
  // Add the new calculated fields
  totalItems: number
  totalPrice: number
}

export interface FetchGiftCardsOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  is_active?: boolean
  is_digital?: boolean
  is_reloadable?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  purchaser_id?: string
  from_date?: string
  to_date?: string
  min_balance?: number
  max_balance?: number
}

interface BaseResponse {
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface GiftCardResponse extends BaseResponse {
  data: GiftCardJsonResponse[]
}

export interface GiftCardStats {
  total: number
  active: number
  by_status: Array<{ status: string, count: number }>
  by_balance: {
    low: number // Count of cards with less than 25% of initial balance
    medium: number // Count of cards with 25-75% of initial balance
    high: number // Count of cards with more than 75% of initial balance
  }
  expiring_soon: GiftCardJsonResponse[]
  recently_used: GiftCardJsonResponse[]
}

export interface FetchProductReviewsOptions {
  page?: number
  limit?: number
}

export interface ProductReviewResponse extends BaseResponse {
  data: ProductReviewJsonResponse[]
}

export interface ProductManufacturerResponse extends BaseResponse {
  data: ManufacturerJsonResponse[]
}
export interface ProductReviewStats {
  total: number
  average_rating: number
  rating_distribution: {
    one_star: number
    two_star: number
    three_star: number
    four_star: number
    five_star: number
  }
  recent_reviews: ProductReviewJsonResponse[]
}

/**
 * Options for fetching product manufacturers
 */
export interface FetchProductManufacturersOptions {
  /** Page number for pagination */
  page?: number

  /** Number of items per page */
  limit?: number

  /** Field to sort by */
  sortBy?: 'manufacturer' | 'country' | 'created_at' | 'updated_at'

  /** Sort direction */
  sortDirection?: 'asc' | 'desc'

  /** Filter by country */
  country?: string

  /** Filter by featured status */
  featured?: boolean

  /** Search term to filter results */
  search?: string
}

export interface FetchCouponsOptions {
  page?: number
  limit?: number
  search?: string
  is_active?: boolean
  discount_type?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  product_id?: string
  category_id?: string
  from_date?: string
  to_date?: string
}

/**
 * Interface for coupon count statistics
 */
export interface CouponCountStats {
  total: number
  active: number
  inactive: number
}

/**
 * Interface for time-based coupon statistics
 */
export interface CouponTimeStats {
  week: CouponCountStats
  month: CouponCountStats
  year: CouponCountStats
  all_time: CouponCountStats
}

/**
 * Interface for coupon redemption statistics
 */
export interface CouponRedemptionStats {
  total: number
  week: number
  month: number
  year: number
  by_type: Record<string, number>
}
