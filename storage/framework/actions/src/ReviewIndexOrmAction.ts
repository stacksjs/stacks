import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Index',
  description: 'Review Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Review.all()

    return response.json(results)
  },
})
