import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistProduct } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Store',
  description: 'WaitlistProduct Store ORM Action',
  method: 'POST',
  async handle(request: WaitlistProductRequestType) {
    await request.validate()
    const model = await WaitlistProduct.create(request.all())

    return response.json(model)
  },
})
