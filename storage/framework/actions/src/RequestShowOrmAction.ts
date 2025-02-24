import type { RequestRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Request Show',
  description: 'Request Show ORM Action',
  method: 'GET',
  async handle(request: RequestRequestType) {
    const id = request.getParam('id')

    const model = await Request.findOrFail(Number(id))

    return response.json(model)
  },
})
