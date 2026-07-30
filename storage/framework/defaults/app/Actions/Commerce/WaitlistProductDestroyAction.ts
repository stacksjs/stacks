import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Destroy',
  description: 'Deletes a product waitlist entry through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await waitlists.products.destroy(id)

    return response.noContent()
  },
})
