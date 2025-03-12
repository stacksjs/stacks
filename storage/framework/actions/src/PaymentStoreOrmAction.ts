import type { PaymentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Store',
  description: 'Payment Store ORM Action',
  method: 'POST',
  async handle(request: PaymentRequestType) {
    await request.validate()
    const model = await Payment.create(request.all())

    return response.json(model)
  },
})
