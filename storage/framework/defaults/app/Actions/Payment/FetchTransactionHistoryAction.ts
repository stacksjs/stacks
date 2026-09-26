import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchTransactionHistoryAction',
  description: 'Fetch the users transaction history',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const transactions = await PaymentTransaction.where('user_id', Number(user.id)).get()

    return response.json(transactions)
  },
})
