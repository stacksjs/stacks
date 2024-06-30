import { Action } from '@stacksjs/actions'
import type { SubscriberRequestType } from '../../types/requests'
import Subscriber from '../src/models/Subscriber'

export default new Action({
  name: 'Subscriber Update',
  description: 'Subscriber Update ORM Action',
  method: 'PATCH',
  async handle(request: SubscriberRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const model = await Subscriber.findOrFail(Number(id))

    return model.update(request.all())
  },
})
