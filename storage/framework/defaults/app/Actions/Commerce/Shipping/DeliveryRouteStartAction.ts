import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier } from '../commerce-action'
import { assertRouteBelongsToCourier, courierFromSession } from './courier-session'

/**
 * Begin a run.
 *
 * Until a route is active, pings from its courier find no active route, so
 * positions are stored but no ETA is recomputed and no arrival ever fires. A
 * courier app that forgets this call looks like a courier who never moves.
 */
export default new Action({
  name: 'Delivery Route Start',
  description: 'Start a delivery route for the authenticated courier.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const session = await courierFromSession(request)
    if (session.error)
      return session.error

    const identifier = commerceIdentifier(request, 'DeliveryRoute')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const denied = await assertRouteBelongsToCourier(id, session.courierId)
    if (denied)
      return denied

    await shippings.tracking.startRoute(id)

    return response.json({ id, status: 'active' })
  },
})
