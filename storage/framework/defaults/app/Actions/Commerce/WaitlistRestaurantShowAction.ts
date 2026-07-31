import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistRestaurant Show',
  description: 'WaitlistRestaurant Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Restaurant waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await waitlists.restaurant.fetchById(id)
    if (!model)
      return commerceNotFound('Restaurant waitlist entry', id)

    return response.json(model)
  },
})
