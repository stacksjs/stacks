import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { seatLicense } from './license-seat-access'

/** Take a member's seat back, releasing the devices activated under it. */
export default new Action({
  name: 'License Seat Destroy',
  description: 'Remove a member\'s seat on a team license.',
  method: 'DELETE',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const access = await seatLicense(request)
    if (access.error)
      return access.error
    const userId = Number(request.get('userId'))
    if (!Number.isSafeInteger(userId) || userId < 1)
      return response.json({ ok: false, reason: 'invalid-user', message: 'userId must be a team member\'s user id.' }, 422)

    const result = await licensing.unassignLicenseSeat({ key: access.license.key, userId })
    return response.json({ ok: true, removed: result.removed })
  },
})
