import type { WebsocketRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Websocket } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Websocket Show',
  description: 'Websocket Show ORM Action',
  method: 'GET',
  async handle(request: WebsocketRequestType) {
    const id = request.getParam('id')

    const model = await Websocket.findOrFail(id)

    return response.json(model)
  },
})
