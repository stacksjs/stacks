import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Index',
  description: 'GiftCard Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await giftCards.fetchAll()

    return response.json(results)
  },
})
