import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateSetupIntentAction',
  description: 'Create Setup Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const setupIntent = await user?.createSetupIntent({
      payment_method_types: ['card', 'link', 'us_bank_account'],
    })

    return response.json(setupIntent)
  },
})
