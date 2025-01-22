import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchPaymentCustomerAction',
  description: 'Fetch the payment customer',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    const user = await User.find(id)

    const customer = await user?.asStripeUser()

    return response.json(customer)
  },
})
