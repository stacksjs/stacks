import type { LogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Update',
  description: 'Log Update ORM Action',
  method: 'PATCH',
  async handle(request: LogRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Log.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
