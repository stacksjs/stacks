import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'WaitlistProduct Destroy',
  description: 'Deletes a product waitlist entry through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product waitlist entry')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await waitlists.products.destroy(id)
    if (!deleted)
      return commerceNotFound('Product waitlist entry', id)

    return response.noContent()
  },
})
