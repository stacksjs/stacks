import type { PaymentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Show',
  description: 'Payment Show ORM Action',
  method: 'GET',

  async handle(request: PaymentRequestType) {
    const id = request.get('id')

    const payment = await payments.fetchById(id)

    return response.json(payment)
  },
})
