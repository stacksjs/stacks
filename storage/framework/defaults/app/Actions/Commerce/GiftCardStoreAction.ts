import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Store',
  description: 'GiftCard Store ORM Action',
  method: 'POST',
  model: GiftCard,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())

    const model = await giftCards.store(data)

    return response.json(model)
  },
})
