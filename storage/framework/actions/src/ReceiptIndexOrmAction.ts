import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Index',
  description: 'Receipt Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Receipt.all()

    return response.json(results)
  },
})
