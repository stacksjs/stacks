import type { UserModel } from '@stacksjs/orm'
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

    // Checkout needs the billable trait, which the default User model leaves
    // OFF ("not every app bills through the User model"). Without it the
    // methods manageCheckout calls - hasStripeId() and friends - are not on
    // the record at all, so say which switch is missing instead of failing
    // deeper in with "user.hasStripeId is not a function".
    if (typeof (user as unknown as Partial<UserModel>).hasStripeId !== 'function') {
      return response.json(
        { message: 'Billing is not enabled. Set `traits.billable` on the User model to use checkout.' },
        503,
      )
    }

    const session = await manageCheckout.create(user as unknown as UserModel, params)

    return response.json({ url: session.url })
  },
})
