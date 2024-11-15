import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchDefaultPaymentMethodAction',
  description: 'Fetch the users default payment method',
  method: 'GET',
  async handle() {
    const user = await User.find(2)

    const paymentMethod = await user?.defaultPaymentMethod()

    return paymentMethod
  },
})
