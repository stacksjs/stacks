import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistProduct } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Destroy',
  description: 'WaitlistProduct Destroy ORM Action',
  method: 'DELETE',
  async handle(request: WaitlistProductRequestType) {
    const id = request.getParam<number>('id')

    const model = await WaitlistProduct.findOrFail(id)

    model.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
