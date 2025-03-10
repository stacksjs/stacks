import type { ProductReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductReview Store',
  description: 'ProductReview Store ORM Action',
  method: 'POST',
  async handle(request: ProductReviewRequestType) {
    await request.validate()
    const model = await ProductReview.create(request.all())

    return response.json(model)
  },
})
