import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Destroy',
  description: 'WaitlistProduct Destroy ORM Action',
  method: 'DELETE',
  async handle(request: WaitlistProductRequestType) {
    const id = request.getParam('id')

    await waitlists.products.destroy(id)

    return response.json({ message: 'WaitlistProduct deleted successfully' })
  },
})
