import type { ReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Show',
  description: 'Review Show ORM Action',
  method: 'GET',
  async handle(request: ReviewRequestType) {
    const id = request.getParam('id')

    const model = await Review.findOrFail(Number(id))

    return response.json(model)
  },
})
