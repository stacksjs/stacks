import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Store',
  description: 'GiftCard Store ORM Action',
  method: 'POST',
  async handle(request: GiftCardRequestType) {
    const model = await giftCards.store(request)

    return response.json(model)
  },
})
