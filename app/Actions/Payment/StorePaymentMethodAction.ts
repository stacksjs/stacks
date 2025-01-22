import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'StorePaymentMethodAction',
  description: 'Store the customers payment methods',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)
    const paymentIntent = request.get('setupIntent') as string

    const paymentMethod = await user?.addPaymentMethod(paymentIntent)

    return response.json(paymentMethod)
  },
})
