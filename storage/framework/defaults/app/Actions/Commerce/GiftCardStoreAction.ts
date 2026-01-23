import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Store',
  description: 'GiftCard Store ORM Action',
  method: 'POST',
  async handle(request: GiftCardRequestType) {
    await request.validate()

    const data = {
      customer_id: request.get<number>('customer_id'),
      code: request.get('code'),
      initial_balance: request.get<number>('initial_balance'),
      current_balance: request.get<number>('current_balance'),
      status: request.get('status'),
      currency: request.get('currency'),
      purchaser_id: request.get('purchaser_id'),
      purchaser_type: request.get('purchaser_type'),
      recipient_email: request.get('recipient_email'),
      recipient_name: request.get('recipient_name'),
      personal_message: request.get('personal_message'),
      expires_at: request.get('expires_at'),
      used_at: request.get('used_at'),

    }

    const model = await giftCards.store(data)

    return response.json(model)
  },
})
