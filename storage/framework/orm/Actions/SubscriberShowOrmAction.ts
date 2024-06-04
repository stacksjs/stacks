import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'
 import type { SubscriberRequestType } from '../../requests/SubscriberRequest'

export default new Action({
      name: 'Subscriber Show',
      description: 'Subscriber Show ORM Action',
      method: 'GET',
      async handle(request: SubscriberRequestType) {
        const id = await request.getParam('id')

        return Subscriber.findOrFail(Number(id))
      },
    })
  