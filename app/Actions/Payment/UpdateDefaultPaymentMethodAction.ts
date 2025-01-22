import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'UpdateDefaultPaymentMethodAction',
  description: 'Update the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const paymentMethod = Number(request.get('paymentMethod'))

    await user?.setDefaultPaymentMethod(paymentMethod)
  },
})
