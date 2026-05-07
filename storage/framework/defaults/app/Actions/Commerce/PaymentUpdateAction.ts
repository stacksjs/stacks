import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Update',
  description: 'Payment Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      order_id: request.get<number>('order_id'),
      customer_id: request.get<number>('customer_id'),
      amount: request.get<number>('amount'),
      method: request.get('method'),
      status: request.get('status'),
      currency: request.get('currency'),
      reference_number: request.get('reference_number'),
      card_last_four: request.get('card_last_four'),
      card_brand: request.get('card_brand'),
      billing_email: request.get('billing_email'),
      transaction_id: request.get('transaction_id'),
      payment_provider: request.get('payment_provider'),
      refund_amount: request.get<number>('refund_amount'),
      notes: request.get('notes'),
    }

    const model = await payments.update(id, data)

    return response.json(model)
  },
})
