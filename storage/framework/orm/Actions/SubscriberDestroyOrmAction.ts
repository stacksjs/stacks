import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'Subscriber Destroy',
      description: 'Subscriber Destroy ORM Action',
      method: 'DELETE',
      async handle() {
        const id = request.getParam('id')

        const model = await Subscriber.findOrFail(Number(id))

        model.delete()

        return 'Model deleted!'
      },
    })
  