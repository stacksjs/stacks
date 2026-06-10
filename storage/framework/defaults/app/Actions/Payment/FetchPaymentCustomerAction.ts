import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchPaymentCustomerAction',
  description: 'Fetch the payment customer',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const customer = await user?.asStripeUser()

    return response.json(customer)
  },
})
