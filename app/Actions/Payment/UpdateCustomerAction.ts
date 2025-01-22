import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UpdateCustomerAction',
  description: 'Update customer detauls',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const customer = await user?.syncStripeCustomerDetails({ address: {
      line1: '123 Elm St',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
    } })

    return response.json(customer)
  },
})
