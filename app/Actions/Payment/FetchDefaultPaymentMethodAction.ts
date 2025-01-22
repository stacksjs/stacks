import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchDefaultPaymentMethodAction',
  description: 'Fetch the users default payment method',
  method: 'GET',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const paymentMethod = await user?.defaultPaymentMethod()

    return response.json(paymentMethod)
  },
})
