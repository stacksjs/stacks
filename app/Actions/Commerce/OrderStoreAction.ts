import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Store',
  description: 'Order Store ORM Action',
  method: 'POST',
  async handle(request: OrderRequestType) {
    await request.validate()

    const data = {
      customer_id: request.get<number>('customer_id'),
      total_amount: request.get<number>('total_amount'),
      status: request.get('status'),
      currency: request.get('currency'),
      shipping_address: request.get('shipping_address'),
      billing_address: request.get('billing_address'),
      shipping_method: request.get('shipping_method'),
      payment_method: request.get('payment_method'),
      payment_status: request.get('payment_status'),
      order_type: request.get('order_type'),
      coupon_id: request.get<number>('coupon_id'),
    }

    const model = await orders.store(data)

    return response.json(model)
  },
})
