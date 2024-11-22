import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchPaymentCustomerAction',
  description: 'Fetch the payment customer',
  method: 'GET',
  async handle() {
    const user = await User.find(1)

    const customer = await user?.asStripeUser()

    return customer
  },
})
