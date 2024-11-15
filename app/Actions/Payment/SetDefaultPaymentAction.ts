import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'SetDefaultPaymentAction',
  description: 'Set the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await User.find(2)
    const paymentIntent = request.get('setupIntent') as string

    const paymentMethod = await user?.setDefaultPaymentMethod(paymentIntent)

    return paymentMethod
  },
})
