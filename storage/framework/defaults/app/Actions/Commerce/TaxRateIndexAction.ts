import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Index',
  description: 'TaxRate Index ORM Action',
  method: 'GET',
  async handle() {
    const results = tax.fetchAll()

    return response.json(results)
  },
})
