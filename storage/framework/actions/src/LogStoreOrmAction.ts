import type { LogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Store',
  description: 'Log Store ORM Action',
  method: 'POST',
  async handle(request: LogRequestType) {
    await request.validate()
    const model = await Log.create(request.all())

    return response.json(model)
  },
})
