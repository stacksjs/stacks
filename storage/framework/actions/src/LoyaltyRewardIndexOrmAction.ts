import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyReward Index',
  description: 'LoyaltyReward Index ORM Action',
  method: 'GET',
  async handle() {
    const results = LoyaltyReward.all()

    return response.json(results)
  },
})
