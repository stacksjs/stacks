import type { WebsocketRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Websocket Show',
  description: 'Websocket Show ORM Action',
  method: 'GET',
  async handle(request: WebsocketRequestType) {
    const id = request.getParam('id')

    const model = await db.selectFrom('websockets').selectAll().where('id', '=', id).executeTakeFirst()

    return response.json(model)
  },
})
