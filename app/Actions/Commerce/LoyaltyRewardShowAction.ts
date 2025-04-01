import type { LoyaltyRewardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyReward Show',
  description: 'LoyaltyReward Show ORM Action',
  method: 'GET',
  async handle(request: LoyaltyRewardRequestType) {
    const id = request.getParam('id')

    const model = await LoyaltyReward.findOrFail(Number(id))

    return response.json(model)
  },
})
