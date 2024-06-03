import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

export default new Action({
      name: 'Subscriber Index',
      description: 'Subscriber Index ORM Action',
      method: 'GET',
      async handle(request: any) {
        return await Subscriber.all()
      },
    })
  