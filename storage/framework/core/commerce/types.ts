// Define the customer table structure
export interface CustomerTable {
  id: number
  name: string
  email: string
  phone: string
  orders: number
  totalSpent: number
  lastOrder: string
  status: 'Active' | 'Inactive'
  avatar: string
  user_id?: number
  created_at?: string
  updated_at?: string
  uuid?: string
}

// Define the input for creating a customer
export interface CreateCustomerInput {
  name: string
  email: string
  phone: string
  orders?: number
  totalSpent?: number
  lastOrder?: string
  status?: 'Active' | 'Inactive'
  avatar?: string
  user_id?: number
}

// Define the input for updating a customer
export interface UpdateCustomerInput {
  name?: string
  email?: string
  phone?: string
  orders?: number
  totalSpent?: number
  lastOrder?: string
  status?: 'Active' | 'Inactive'
  avatar?: string
  user_id?: number
}
