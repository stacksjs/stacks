import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'Subscriber Show',
  description: 'Subscriber Show ORM Action',
  method: 'GET',
  async handle() {
    const id = await request.getParam('id')

    return Subscriber.findOrFail(Number(id))
  },
})
