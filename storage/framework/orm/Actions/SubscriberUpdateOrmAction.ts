import { Action } from '@stacksjs/actions'
import Subscriber from '../src/models/Subscriber'

export default new Action({
      name: 'Subscriber Update',
      description: 'Subscriber Update ORM Action',
      method: 'PATCH',
      async handle(request: any) {
        const id = request.getParam('id')

        const model = await Subscriber.findOrFail(Number(id))

        return model.update(request.all())
      },
    })
  