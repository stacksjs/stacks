import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Store',
  description: 'WaitlistProduct Store ORM Action',
  method: 'POST',
  async handle(request: WaitlistProductRequestType) {
    const model = await waitlists.products.store(request)

    return response.json(model)
  },
})
