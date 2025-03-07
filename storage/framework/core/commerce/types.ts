import type { Insertable, Selectable, Updateable } from '@stacksjs/database'

import type { CouponModel } from '../../orm/src/models/Coupon'
// Import the CustomerTable type from the ORM
import type {
  CustomerJsonResponse,
  CustomerModel,
  CustomersTable,
  CustomerType,
  CustomerUpdate,
  NewCustomer,
} from '../../orm/src/models/Customer'
// Import the OrderTable type from the ORM
import type { OrdersTable } from '../../orm/src/models/Order'
import type { OrderItemModel } from '../../orm/src/models/OrderItem'

// Re-export the types
export type {
  CustomerJsonResponse,
  CustomersTable,
  CustomerType,
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

export interface OrderJsonResponse extends OrderTable {
  [key: string]: any
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
    start_date: string | undefined
    end_date: string | undefined
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
