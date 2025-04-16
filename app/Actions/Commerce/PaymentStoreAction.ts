import type { PaymentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Store',
  description: 'Payment Store ORM Action',
  method: 'POST',
  async handle(request: PaymentRequestType) {
    await request.validate()

    const data = {
      order_id: request.get<number>('order_id'),
      customer_id: request.get<number>('customer_id'),
      amount: request.get<number>('amount'),
      method: request.get('method'),
      status: request.get('status'),
    }

    const model = await payments.store(data)

    return response.json(model)
  },
})
