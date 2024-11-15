import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchPaymentMethodsAction',
  description: 'Fetch the user payment methods',
  method: 'GET',
  async handle() {
    const user = await User.find(2)

    const paymentMethods = await user?.paymentMethods()

    return paymentMethods
  },
})
