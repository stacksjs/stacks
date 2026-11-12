import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { refusal } from './license-response'
import { seatLicense } from './license-seat-access'

/** Give a member of the license's team a seat. */
export default new Action({
  name: 'License Seat Store',
  description: 'Assign a team license seat to a member of its team.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const access = await seatLicense(request)
    if (access.error)
      return access.error
    const userId = Number(request.get('userId'))
    if (!Number.isSafeInteger(userId) || userId < 1)
      return response.json({ ok: false, reason: 'invalid-user', message: 'userId must be a team member\'s user id.' }, 422)

    const result = await licensing.assignLicenseSeat({ key: access.license.key, userId })
    if (!result.ok)
      return refusal(result.reason, result.message)
    return response.json({ ok: true, seat: result.seat })
  },
})
