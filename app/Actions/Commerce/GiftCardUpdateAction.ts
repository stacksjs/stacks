import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Update',
  description: 'GiftCard Update ORM Action',
  method: 'PUT',
  async handle(request: GiftCardRequestType) {
    const id = request.getParam('id')

    const data = {
      code: request.get('code'),
      initial_balance: request.get<number>('initial_balance'),
      current_balance: request.get<number>('current_balance'),
      status: request.get('status'),
      currency: request.get('currency'),
    }

    const model = await giftCards.update(id, data)

    return response.json(model)
  },
})
