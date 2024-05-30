import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'Subscriber Store',
  description: 'Subscriber Store ORM Action',
  method: 'POST',
  async handle() {
    const model = await Subscriber.create(request.all())

    return model
  },
})
