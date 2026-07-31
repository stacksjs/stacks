import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistRestaurant Update',
  description: 'Updates a restaurant waitlist entry through the native commerce module.',
  method: 'PATCH',
  model: WaitlistRestaurant,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Restaurant waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.restaurant.update(id, data)
    if (!model)
      return commerceNotFound('Restaurant waitlist entry', id)

    return response.json(model)
  },
})
