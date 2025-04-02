import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistRestaurant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Show',
  description: 'WaitlistRestaurant Show ORM Action',
  method: 'GET',
  async handle(request: WaitlistRestaurantRequestType) {
    const id = request.getParam<number>('id')

    const model = await WaitlistRestaurant.findOrFail(id)

    return response.json(model)
  },
})
