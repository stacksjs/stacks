import { Action } from '@stacksjs/actions'
import type { SubscriberRequestType } from '../../types/requests'
import Subscriber from '../src/models/Subscriber'

export default new Action({
  name: 'Subscriber Index',
  description: 'Subscriber Index ORM Action',
  method: 'GET',
  async handle(request: SubscriberRequestType) {
    return await Subscriber.all()
  },
})
