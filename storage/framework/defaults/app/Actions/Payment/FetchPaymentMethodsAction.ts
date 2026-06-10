import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchPaymentMethodsAction',
  description: 'Fetch the user payment methods',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const paymentMethods = await user?.paymentMethods()

    return response.json(paymentMethods)
  },
})
