import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Index',
  description: 'GiftCard Index ORM Action',
  method: 'GET',
  async handle() {
    const results = GiftCard.all()

    return response.json(results)
  },
})
