import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateSetupIntent',
  description: 'Create Setup Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const amount = Number(request.get('amount'))

    const user = await User.find(1)

    const paymentIntent = await user?.createSetupIntent()

    return paymentIntent
  },
})
