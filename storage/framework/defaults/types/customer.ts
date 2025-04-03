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