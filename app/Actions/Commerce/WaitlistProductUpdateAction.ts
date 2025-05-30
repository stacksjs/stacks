import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Update',
  description: 'WaitlistProduct Update ORM Action',
  method: 'PATCH',
  async handle(request: WaitlistProductRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      product_id: request.get<number>('product_id'),
      customer_id: request.get<number>('customer_id'),
      name: request.get('name'),
      email: request.get('email'),
      quantity: request.get<number>('quantity'),
      notification_preference: request.get('notification_preference'),
      source: request.get('source'),
      status: request.get('status'),
    }

    const model = await waitlists.products.update(id, data)

    return response.json(model)
  },
})
