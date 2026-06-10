import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchDefaultPaymentMethodAction',
  description: 'Fetch the users default payment method',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const paymentMethod = await user?.defaultPaymentMethod()

    return response.json(paymentMethod)
  },
})
