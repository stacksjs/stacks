import { Action } from '@stacksjs/actions'
import { receipts } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Index',
  description: 'Receipt Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await receipts.fetchAll()

    return response.json(results)
  },
})
