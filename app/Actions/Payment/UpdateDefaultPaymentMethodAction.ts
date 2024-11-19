import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'UpdateDefaultPaymentMethodAction',
  description: 'Update the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await User.find(2)
    const paymentMethod = request.get('paymentMethod') as string

    await user?.setDefaultPaymentMethod(paymentMethod)

    return {}
  },
})
