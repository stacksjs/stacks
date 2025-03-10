import type { ProductReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductReview Show',
  description: 'ProductReview Show ORM Action',
  method: 'GET',
  async handle(request: ProductReviewRequestType) {
    const id = request.getParam('id')

    const model = await ProductReview.findOrFail(Number(id))

    return response.json(model)
  },
})
