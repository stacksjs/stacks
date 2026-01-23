import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { manageCheckout } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Checkout',
  description: 'Checkout Action',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user) {
      return response.json({ message: 'User not found' }, 404)
    }

    const params = {
      success_url: 'https://localhost:3000/success',
      cancel_url: 'https://localhost:3000/cancel',
    }

    const session = await manageCheckout.create(user, params)

    return response.json({ url: session.url })
  },
})
