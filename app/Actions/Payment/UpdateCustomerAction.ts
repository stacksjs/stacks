import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'UpdateCustomerAction',
  description: 'Update customer detauls',
  method: 'POST',
  async handle() {
    // async handle(request: RequestInstance) {
    const user = await User.find(1)

    const customer = await user?.syncStripeCustomerDetails({ address: {
      line1: '123 Elm St',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
    } })

    return customer
  },
})
