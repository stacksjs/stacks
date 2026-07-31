import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Payment Destroy',
  description: 'Payment Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Payment')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await payments.destroy(id)
    if (!deleted)
      return commerceNotFound('Payment', id)

    return response.noContent()
  },
})
