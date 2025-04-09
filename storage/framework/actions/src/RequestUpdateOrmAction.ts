import type { RequestRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Request } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Request Update',
  description: 'Request Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Request.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
