import type { LoyaltyRewardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyReward Store',
  description: 'LoyaltyReward Store ORM Action',
  method: 'POST',
  async handle(request: LoyaltyRewardRequestType) {
    await request.validate()
    const model = await LoyaltyReward.create(request.all())

    return response.json(model)
  },
})
