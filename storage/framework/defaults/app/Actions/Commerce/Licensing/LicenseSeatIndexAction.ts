import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { seatLicense } from './license-seat-access'

/** Who holds a seat on a team license, for the team's owner or admin. */
export default new Action({
  name: 'License Seat Index',
  description: 'List the seats assigned on a team license.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const access = await seatLicense(request)
    if (access.error)
      return access.error
    return response.json({ ok: true, seats: access.license.seats, assigned: await licensing.licenseSeats(access.license.key) })
  },
})
