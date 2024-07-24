import { Action } from '@stacksjs/actions'
import type { SubscriberRequestType } from '../../types/requests'
import Subscriber from '../src/models/Subscriber'

export default new Action({
  name: 'Subscriber Show',
  description: 'Subscriber Show ORM Action',
  method: 'GET',
  async handle(request: SubscriberRequestType) {
    const id = await request.getParam('id')

    return await Subscriber.findOrFail(Number(id))
  },
})
