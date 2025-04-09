import type { LogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Destroy',
  description: 'Log Destroy ORM Action',
  method: 'DELETE',
  async handle(request: LogRequestType) {
    const id = request.getParam('id')

    const model = await Log.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
