import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Index',
  description: 'TaxRate Index ORM Action',
  method: 'GET',
  async handle() {
    const results = TaxRate.all()

    return response.json(results)
  },
})
