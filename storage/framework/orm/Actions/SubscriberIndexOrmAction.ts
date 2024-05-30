import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'Subscriber Index',
  description: 'Subscriber Index ORM Action',
  method: 'GET',
  async handle() {
    return await Subscriber.all()
  },
})
