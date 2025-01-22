import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'StoreTransactionAction',
  description: 'Store transactions',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const productId = Number(request.get('productId'))

    const user = await User.find(userId)

    const transaction = await user?.storeTransaction(productId)

    return response.json(transaction)
  },
})
