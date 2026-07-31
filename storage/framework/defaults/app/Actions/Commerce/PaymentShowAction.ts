import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Payment Show',
  description: 'Payment Show ORM Action',
  method: 'GET',

  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Payment')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const payment = await payments.fetchById(id)
    if (!payment)
      return commerceNotFound('Payment', id)

    return response.json(payment)
  },
})
