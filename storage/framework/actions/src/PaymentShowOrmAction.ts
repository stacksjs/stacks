import type { PaymentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import Payment from '../../orm/src/models/Payment'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Show',
  description: 'Payment Show ORM Action',
  method: 'GET',
  async handle(request: PaymentRequestType) {
    const id = request.getParam('id')

    const model = await Payment.findOrFail(Number(id))

    return response.json(model)
  },
})
