import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'StoreTransactionAction',
  description: 'Store transactions',
  method: 'POST',
  async handle(request: RequestInstance) {
    const productId = Number(request.get('productId'))

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const transaction = await user?.storeTransaction(productId)

    return response.json(transaction)
  },
})
