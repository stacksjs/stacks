import type { Insertable, Selectable, Updateable } from '@stacksjs/database'

// Import the OrderTable type from the ORM
import type { OrdersTable } from '../../../../orm/src/models/Order'
// Import the CustomerTable type from the ORM
import type {
  CustomerJsonResponse,
  CustomersTable,
  CustomerType,
  CustomerUpdate,
  NewCustomer,
} from '../../orm/src/models/Customer'

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

// Define a common request type for working with orders
export interface OrderRequestType {
  customer_id?: number
  status?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  delivery_fee?: number
  tip_amount?: number
  order_type?: string
  delivery_address?: string
  special_instructions?: string
  estimated_delivery_time?: string
  applied_coupon_id?: string
  order_items?: string | OrderItem[]
}

// Define the structure of an order item
export interface OrderItem {
  product_id: string
  quantity: number
  price: number
  special_instructions?: string
}
