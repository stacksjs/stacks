import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'
import { assertStopBelongsToCourier, courierFromSession } from './courier-session'

/**
 * The courier is driving to this stop.
 *
 * On a dropoff this is what puts the order out for delivery and starts the
 * customer's tracking page; on a pickup it only moves the stop.
 */
export default new Action({
  name: 'Delivery Stop Start',
  description: 'Mark a stop as en route for the authenticated courier.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const session = await courierFromSession(request)
    if (session.error)
      return session.error

    const identifier = commerceIdentifier(request, 'DeliveryStop')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const denied = await assertStopBelongsToCourier(id, session.courierId)
    if (denied)
      return denied

    const stop = await shippings.tracking.startStop(id)
    if (!stop)
      return commerceNotFound('DeliveryStop', id)

    return response.json(stop)
  },
})
