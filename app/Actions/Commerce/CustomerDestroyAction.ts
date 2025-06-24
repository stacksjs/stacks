import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { customers } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Destroy',
  description: 'Customer Destroy ORM Action',
  method: 'DELETE',
  async handle(request: CustomerRequestType) {
    const id = request.getParam('id')

    await customers.destroy(id)

    return response.noContent()
  },
})
