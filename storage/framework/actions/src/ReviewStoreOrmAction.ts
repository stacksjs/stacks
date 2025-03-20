import type { ReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Store',
  description: 'Review Store ORM Action',
  method: 'POST',
  async handle(request: ReviewRequestType) {
    await request.validate()
    const model = await Review.create(request.all())

    return response.json(model)
  },
})
