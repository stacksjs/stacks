import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchTransactionHistoryAction',
  description: 'Fetch the users transaction history',
  method: 'GET',
  async handle() {
    const user = await User.find(1)

    const transactions = await user?.subscriptionHistory()

    return transactions
  },
})
