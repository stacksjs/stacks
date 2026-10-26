import { Action } from '@stacksjs/actions/runtime'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Store',
  description: 'Payment Store ORM Action',
  method: 'POST',
  async handle(request: RequestInstance) {
    await request.validate()

    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value or the column default (stacksjs/stacks#3010).
    const data = request.only(['order_id', 'customer_id', 'amount', 'method', 'status'])

    const model = await payments.store(data as Parameters<typeof payments.store>[0])

    return response.json(model)
  },
})
