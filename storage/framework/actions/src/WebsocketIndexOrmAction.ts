import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Websocket Index',
  description: 'Websocket Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Websocket.all()

    return response.json(results)
  },
})
