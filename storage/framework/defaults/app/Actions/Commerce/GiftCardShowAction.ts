import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'GiftCard Show',
  description: 'GiftCard Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Gift card')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await giftCards.fetchById(id)
    if (!model)
      return commerceNotFound('Gift card', id)

    return response.json(model)
  },
})
