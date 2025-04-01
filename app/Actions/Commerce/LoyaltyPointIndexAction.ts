import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoyaltyPoint Index',
  description: 'LoyaltyPoint Index ORM Action',
  method: 'GET',
  async handle() {
    const results = LoyaltyPoint.all()

    return response.json(results)
  },
})
