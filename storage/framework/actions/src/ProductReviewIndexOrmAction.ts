import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductReview Index',
  description: 'ProductReview Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductReview.all()

    return response.json(results)
  },
})
