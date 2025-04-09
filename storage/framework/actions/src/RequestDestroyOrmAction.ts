import type { RequestRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Request } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Request Destroy',
  description: 'Request Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestRequestType) {
    const id = request.getParam('id')

    const model = await Request.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
