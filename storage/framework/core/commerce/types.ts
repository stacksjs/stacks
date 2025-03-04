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
