import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { WaitlistRestaurant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Destroy',
  description: 'WaitlistRestaurant Destroy ORM Action',
  method: 'DELETE',
  async handle(request: WaitlistRestaurantRequestType) {
    const id = request.getParam('id')

    const model = await WaitlistRestaurant.findOrFail(Number(id))

    model.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
