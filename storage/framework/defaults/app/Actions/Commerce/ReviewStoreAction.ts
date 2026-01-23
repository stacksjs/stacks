import type { ReviewRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Store',
  description: 'Review Store ORM Action',
  method: 'POST',
  async handle(request: ReviewRequestType) {
    await request.validate()

    const data = {
      product_id: request.get<number>('product_id'),
      customer_id: request.get<number>('customer_id'),
      rating: request.get<number>('rating'),
      title: request.get('title'),
      content: request.get('content'),
      is_verified_purchase: request.get<boolean>('is_verified_purchase'),
      is_approved: request.get<boolean>('is_approved'),
    }

    const model = await products.reviews.store(data)

    return response.json(model)
  },
})
