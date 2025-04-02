import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Update',
  description: 'WaitlistProduct Update ORM Action',
  method: 'PATCH',
  async handle(request: WaitlistProductRequestType) {
    const id = request.getParam<number>('id')
    const model = await waitlists.products.update(id, request)

    return response.json(model)
  },
})
