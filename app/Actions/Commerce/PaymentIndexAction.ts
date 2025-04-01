import type { PaymentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Index',
  description: 'Payment Index ORM Action',
  method: 'GET',

  async handle(request: PaymentRequestType) {
    const results = await payments.fetchAll()

    return response.json(results)
  },
})
