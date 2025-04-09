import type { LogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Show',
  description: 'Log Show ORM Action',
  method: 'GET',
  async handle(request: LogRequestType) {
    const id = request.getParam('id')

    const model = await Log.findOrFail(id)

    return response.json(model)
  },
})
