import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'GiftCard Update',
  description: 'GiftCard Update ORM Action',
  method: 'PATCH',
  model: GiftCard,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Gift card')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())

    const model = await giftCards.update(id, data)
    if (!model)
      return commerceNotFound('Gift card', id)

    return response.json(model)
  },
})
