import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Show',
  description: 'GiftCard Show ORM Action',
  method: 'GET',
  async handle(request: GiftCardRequestType) {
    const id = request.getParam('id')

    const model = await GiftCard.findOrFail(Number(id))

    return response.json(model)
  },
})
