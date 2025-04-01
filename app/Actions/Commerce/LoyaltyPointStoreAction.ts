import type { LoyaltyPointRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyPoint Store',
  description: 'LoyaltyPoint Store ORM Action',
  method: 'POST',
  async handle(request: LoyaltyPointRequestType) {
    await request.validate()
    const model = await LoyaltyPoint.create(request.all())

    return response.json(model)
  },
})
