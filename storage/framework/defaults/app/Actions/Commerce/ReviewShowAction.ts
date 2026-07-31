import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Review Show',
  description: 'Review Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Review')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await products.reviews.fetchById(id)
    if (!model)
      return commerceNotFound('Review', id)

    return response.json(model)
  },
})
