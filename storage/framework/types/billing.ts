export interface TransactionHistory {
  id?: number
  uuid?: string
  name: string
  description?: string
  amount: number
  type: string
  provider_id?: string
  user_id?: number
  paymentmethod_id?: number
  created_at: string
  updated_at?: string
}

export interface PaymentMethod {
  id?: number
  uuid?: string
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default?: boolean
  provider_id?: string
  user_id?: number
  created_at: string
  updated_at?: string
}

export interface Product {
  id?: number
  uuid?: string
  name: string
  description?: number
  key: number
  unit_price?: number
  status?: string
  image?: string
  provider_id?: string
  created_at: string
  updated_at?: string
}

export interface Subscription {
  id?: number
  uuid?: string
  type: string
  provider_id: string
  provider_status: string
  unit_price?: number
  provider_type: string
  provider_price_id?: string
  quantity?: number
  trial_ends_at?: string
  ends_at?: string
  last_used_at?: string
  user_id?: number
  created_at: string
  updated_at?: string
}
