import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'
import { assertStopBelongsToCourier, courierFromSession } from './courier-session'

/**
 * The handover is done.
 *
 * Completing a dropoff marks the order delivered; completing a pickup means the
 * order is on the vehicle and moves it out for delivery instead.
 */
export default new Action({
  name: 'Delivery Stop Complete',
  description: 'Complete a stop for the authenticated courier.',
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

    const notes = request.get<string>('notes')
    const stop = await shippings.tracking.completeStop(id, typeof notes === 'string' && notes ? notes : undefined)
    if (!stop)
      return commerceNotFound('DeliveryStop', id)

    return response.json(stop)
  },
})
