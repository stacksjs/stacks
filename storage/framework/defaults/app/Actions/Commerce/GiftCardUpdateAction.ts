import { Action } from '@stacksjs/actions'

import { giftCards } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'GiftCard Update',
  description: 'GiftCard Update ORM Action',
  method: 'PATCH',
  model: GiftCard,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')
    const data = toSnakeCaseKeys(request.all())

    const model = await giftCards.update(id, data)

    return response.json(model)
  },
})
