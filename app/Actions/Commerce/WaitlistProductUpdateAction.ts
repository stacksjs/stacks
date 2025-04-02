import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistProduct } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Update',
  description: 'WaitlistProduct Update ORM Action',
  method: 'PATCH',
  async handle(request: WaitlistProductRequestType) {
    await request.validate()

    const id = request.getParam<number>('id')
    const model = await WaitlistProduct.findOrFail(id)

    const result = model.update(request.all())

    return response.json(result)
  },
})
