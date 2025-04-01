import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistRestaurant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Update',
  description: 'WaitlistRestaurant Update ORM Action',
  method: 'PATCH',
  async handle(request: WaitlistRestaurantRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await WaitlistRestaurant.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
