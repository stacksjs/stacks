import type { Insertable, Selectable, Updateable } from '@stacksjs/database'

// Import the CustomerTable type from the ORM
import type {
  CustomerJsonResponse,
  CustomersTable,
  CustomerType,
  CustomerUpdate,
  NewCustomer,
} from '../../orm/src/models/Customer'
// Import the OrderTable type from the ORM
import type { OrdersTable } from '../../orm/src/models/Order'

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

export interface CouponStats {
  /** Total number of coupons in the system */
  total: number

  /** Number of currently active coupons */
  active: number

  /** Distribution of coupons by discount type */
  by_type: DiscountTypeCount[]

  /** List of most frequently used coupons */
  most_used: {
    id: string
    code: string
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'
    discount_value: number
    usage_count: number
  }[]

  /** List of upcoming coupons that will be active soon */
  upcoming: {
    id: string
    code: string
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'
    discount_value: number
    start_date: string
    end_date: string
  }[]
}

/**
 * Represents statistics for a discount type
 */
export interface DiscountTypeCount {
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'
  count: number
}
