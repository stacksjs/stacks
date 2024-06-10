import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'
  import type { SubscriberRequestType } from '../../types/requests'

export default new Action({
      name: 'Subscriber Store',
      description: 'Subscriber Store ORM Action',
      method: 'POST',
      async handle(request: SubscriberRequestType) {
        await request.validate()
        const model = await Subscriber.create(request.all())

        return model
      },
    })
  