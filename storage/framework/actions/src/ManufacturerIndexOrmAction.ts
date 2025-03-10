import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Index',
  description: 'Manufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Manufacturer.all()

    return response.json(results)
  },
})
