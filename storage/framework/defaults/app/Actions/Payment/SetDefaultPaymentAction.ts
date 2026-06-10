import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SetDefaultPaymentAction',
  description: 'Set the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const paymentId = Number(request.get('setupIntent'))

    const paymentMethod = await user?.setDefaultPaymentMethod(paymentId)

    return response.json(paymentMethod)
  },
})
