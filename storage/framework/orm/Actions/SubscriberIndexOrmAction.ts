import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'
 import type { SubscriberRequestType } from '../../requests/SubscriberRequest'

export default new Action({
      name: 'Subscriber Index',
      description: 'Subscriber Index ORM Action',
      method: 'GET',
      async handle(request: SubscriberRequestType) {
        return await Subscriber.all()
      },
    })
  