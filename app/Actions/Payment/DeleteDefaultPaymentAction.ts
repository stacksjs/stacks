import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'DeleteDefaultPaymentAction',
  description: 'Delete the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await User.find(1)
    const paymentMethod = request.get('paymentMethod') as string

    await user?.deletePaymentMethod(paymentMethod)
  },
})