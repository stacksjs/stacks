import type { UserModel } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED, manageCheckout } from '@stacksjs/payments'
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

    // Checkout needs the billable trait, which the default User model leaves
    // OFF ("not every app bills through the User model"), so say which switch
    // is missing instead of failing deeper in. This used to ask whether
    // `hasStripeId` was a function - a method nothing binds, billable or not -
    // so it answered 503 even in an app that had turned billing on.
    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const session = await manageCheckout.create(user as unknown as UserModel, params)

    return response.json({ url: session.url })
  },
})
