import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'UpdateDefaultPaymentMethodAction',
  description: 'Update the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const paymentMethod = request.get('paymentMethod') as string

    await user?.setDefaultPaymentMethod(paymentMethod)

    return
  },
})
