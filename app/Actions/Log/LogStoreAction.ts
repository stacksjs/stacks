import type { LogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Store',
  description: 'Log Store ORM Action',
  method: 'POST',
  async handle(request: LogRequestType) {
    const data = request.all()

    const model = await Log.create(data)

    return response.json(model)
  },
})
