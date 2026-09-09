import { Action } from '@stacksjs/actions'
import { referralSummary } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ReferralSummaryAction',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user?.id) return response.error('Unauthenticated', 401)
    return response.json(await referralSummary(Number(user.id)))
  },
})
