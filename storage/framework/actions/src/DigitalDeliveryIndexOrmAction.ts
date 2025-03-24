import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Index',
  description: 'DigitalDelivery Index ORM Action',
  method: 'GET',
  async handle() {
    const results = DigitalDelivery.all()

    return response.json(results)
  },
})
