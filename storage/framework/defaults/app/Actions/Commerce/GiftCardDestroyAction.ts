import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Destroy',
  description: 'GiftCard Destroy ORM Action',
  method: 'DELETE',
  async handle(request: GiftCardRequestType) {
    const id = request.getParam('id')

    await giftCards.destroy(id)

    return response.json({ message: 'GiftCard deleted successfully' })
  },
})
