import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'StoreTransactionAction',
  description: 'Store transactions',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const userId = Number(request.getParam('id'))
      const productId = Number(request.get('productId'))

      const user = await User.find(userId)

      const transaction = await user?.storeTransaction(productId)

      return transaction
    }
    catch (err) {
      throw err
    }
  },
})
