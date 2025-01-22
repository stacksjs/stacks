import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchPaymentMethodsAction',
  description: 'Fetch the user payment methods',
  method: 'GET',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const paymentMethods = await user?.paymentMethods()

    return response.json(paymentMethods)
  },
})
