import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateSetupIntentAction',
  description: 'Create Setup Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await User.find(2)

    const setupIntent = await user?.createSetupIntent()

    return setupIntent
  },
})
