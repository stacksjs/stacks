import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistRestaurant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Store',
  description: 'WaitlistRestaurant Store ORM Action',
  method: 'POST',
  async handle(request: WaitlistRestaurantRequestType) {
    await request.validate()
    const model = await WaitlistRestaurant.create(request.all())

    return response.json(model)
  },
})
