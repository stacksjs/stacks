import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'
import { assertStopBelongsToCourier, courierFromSession } from './courier-session'

/**
 * The stop could not be completed.
 *
 * A reason is required rather than optional: this is the record a customer
 * service agent reads back when the customer asks why nobody came, and "failed"
 * on its own does not answer that.
 */
export default new Action({
  name: 'Delivery Stop Fail',
  description: 'Mark a stop as failed for the authenticated courier.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const session = await courierFromSession(request)
    if (session.error)
      return session.error

    const identifier = commerceIdentifier(request, 'DeliveryStop')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const reason = request.get<string>('reason')
    if (typeof reason !== 'string' || reason.trim() === '')
      return response.json({ message: 'reason is required' }, 422)

    const denied = await assertStopBelongsToCourier(id, session.courierId)
    if (denied)
      return denied

    const stop = await shippings.tracking.failStop(id, reason.trim())
    if (!stop)
      return commerceNotFound('DeliveryStop', id)

    return response.json(stop)
  },
})
