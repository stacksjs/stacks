import { Action } from '@stacksjs/actions'
 import { response } from '@stacksjs/router'

  import type { WebsocketRequestType } from '@stacksjs/orm'
 import { Websocket } from '@stacksjs/orm'
 import { response } from '@stacksjs/router'

export default new Action({
      name: 'Websocket Store',
      description: 'Websocket Store ORM Action',
      method: 'POST',
      async handle(request: WebsocketRequestType) {
        await request.validate()
        const model = await Websocket.create(request.all())

        return response.json(model)
      },
    })
  