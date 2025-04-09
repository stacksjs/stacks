import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Show',
  description: 'WaitlistProduct Show ORM Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const id = request.getParam('id')

    const model = await waitlists.products.fetchById(id)

    return response.json(model)
  },
})
