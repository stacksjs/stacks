import type { WebsocketRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Websocket Store',
  description: 'Websocket Store ORM Action',
  method: 'POST',
  async handle(request: WebsocketRequestType) {
    await request.validate()
    const model = await db.insertInto('websockets').values(request.all()).execute()

    return response.json(model)
  },
})
