import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SetUserDefaultPaymentAction',
  description: 'Set the customers default payment method from provider callback',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)
    const paymentId = String(request.get('setupIntent'))

    const paymentMethod = await user?.setUserDefaultPaymentMethod(paymentId)

    return response.json(paymentMethod)
  },
})
