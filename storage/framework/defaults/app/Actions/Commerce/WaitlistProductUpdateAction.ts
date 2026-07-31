import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistProduct Update',
  description: 'Updates a product waitlist entry through the native commerce module.',
  method: 'PATCH',
  model: WaitlistProduct,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.products.update(id, data)
    if (!model)
      return commerceNotFound('Product waitlist entry', id)

    return response.json(model)
  },
})
