import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistProduct Show',
  description: 'WaitlistProduct Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await waitlists.products.fetchById(id)
    if (!model)
      return commerceNotFound('Product waitlist entry', id)

    return response.json(model)
  },
})
