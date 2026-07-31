import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistRestaurant Destroy',
  description: 'Deletes a restaurant waitlist entry through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Restaurant waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await waitlists.restaurant.destroy(id)
    if (!deleted)
      return commerceNotFound('Restaurant waitlist entry', id)

    return response.noContent()
  },
})
