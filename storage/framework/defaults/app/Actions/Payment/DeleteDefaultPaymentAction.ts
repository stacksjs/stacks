import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeleteDefaultPaymentAction',
  description: 'Delete the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const paymentMethod = Number(request.get('paymentMethod'))

    await user?.deletePaymentMethod(paymentMethod)
  },
})
