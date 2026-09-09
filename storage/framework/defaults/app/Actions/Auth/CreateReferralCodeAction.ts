import { Action } from '@stacksjs/actions'
import { createReferralCode } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateReferralCodeAction',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user?.id) return response.error('Unauthenticated', 401)
    return response.json({ code: await createReferralCode(Number(user.id)) })
  },
})
