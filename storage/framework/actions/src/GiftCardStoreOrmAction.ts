import type { GiftCardRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Store',
  description: 'GiftCard Store ORM Action',
  method: 'POST',
  async handle(request: GiftCardRequestType) {
    await request.validate()
    const model = await GiftCard.create(request.all())

    return response.json(model)
  },
})
