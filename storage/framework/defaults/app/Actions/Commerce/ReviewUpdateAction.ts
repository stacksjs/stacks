import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Review Update',
  description: 'Updates a product review through the native commerce module.',
  method: 'PATCH',
  model: Review,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Review')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await products.reviews.update(id, data)
    if (!model)
      return commerceNotFound('Review', id)

    return response.json(model)
  },
})
