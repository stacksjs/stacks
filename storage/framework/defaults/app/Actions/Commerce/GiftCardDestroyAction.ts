import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'GiftCard Destroy',
  description: 'GiftCard Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Gift card')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await giftCards.destroy(id)
    if (!deleted)
      return commerceNotFound('Gift card', id)

    return response.json({ message: 'GiftCard deleted successfully' })
  },
})
