import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Show',
  description: 'GiftCard Show ORM Action',
  method: 'GET',
  async handle(request: GiftCardRequestType) {
    const id = request.getParam('id')

    const model = await giftCards.fetchById(id)

    return response.json(model)
  },
})
