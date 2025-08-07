import type { RequestRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Request } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Request Store',
  description: 'Request Store ORM Action',
  method: 'POST',
  async handle(request: RequestRequestType) {
    await request.validate()
    const model = await Request.create(request.all())

    return response.json(model)
  },
})
