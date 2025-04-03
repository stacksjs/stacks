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
  created_at?: string
  updated_at?: string
}