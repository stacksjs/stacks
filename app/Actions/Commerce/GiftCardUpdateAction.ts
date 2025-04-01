import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Update',
  description: 'GiftCard Update ORM Action',
  method: 'PUT',
  async handle(request: GiftCardRequestType) {
    await request.validate()
    const id = request.getParam('id')

    const model = await giftCards.update(Number(id), request)

    return response.json(model)
  },
})
