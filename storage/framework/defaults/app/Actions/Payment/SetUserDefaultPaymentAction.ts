import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SetUserDefaultPaymentAction',
  description: 'Set the customers default payment method from provider callback',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const paymentId = String(request.get('setupIntent'))

    const paymentMethod = await user?.setUserDefaultPaymentMethod(paymentId)

    return response.json(paymentMethod)
  },
})
