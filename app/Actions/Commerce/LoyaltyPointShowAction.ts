import type { LoyaltyPointRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyPoint Show',
  description: 'LoyaltyPoint Show ORM Action',
  method: 'GET',
  async handle(request: LoyaltyPointRequestType) {
    const id = request.getParam('id')

    const model = await LoyaltyPoint.findOrFail(Number(id))

    return response.json(model)
  },
})
