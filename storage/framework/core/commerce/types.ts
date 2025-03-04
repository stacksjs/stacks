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
