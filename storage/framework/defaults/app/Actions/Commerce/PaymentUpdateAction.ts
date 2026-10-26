import { Action } from '@stacksjs/actions/runtime'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Payment Update',
  description: 'Payment Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Payment')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value or the column default (stacksjs/stacks#3010).
    const data = request.only([
      'order_id',
      'customer_id',
      'amount',
      'method',
      'status',
      'currency',
      'reference_number',
      'card_last_four',
      'card_brand',
      'billing_email',
      'transaction_id',
      'payment_provider',
      'refund_amount',
      'notes',
    ])

    const model = await payments.update(id, data as Parameters<typeof payments.update>[1])
    if (!model)
      return commerceNotFound('Payment', id)

    return response.json(model)
  },
})
