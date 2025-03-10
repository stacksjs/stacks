import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Index',
  description: 'ProductManufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductManufacturer.all()

    return response.json(results)
  },
})
