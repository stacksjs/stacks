import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistProduct } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Show',
  description: 'WaitlistProduct Show ORM Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const id = request.getParam('id')

    const model = await WaitlistProduct.findOrFail(Number(id))

    return response.json(model)
  },
})
