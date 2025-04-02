import type { ReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Store',
  description: 'Review Store ORM Action',
  method: 'POST',
  async handle(request: ReviewRequestType) {
    const model = await products.reviews.store(request)

    return response.json(model)
  },
})
