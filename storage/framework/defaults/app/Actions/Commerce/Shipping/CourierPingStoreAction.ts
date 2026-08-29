import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { courierFromSession } from './courier-session'

/**
 * A position fix from a courier's device.
 *
 * The one write path into `courier_pings`: `recordCourierPing` also moves the
 * courier's denormalised position, recomputes the stop's ETA, broadcasts to
 * everyone watching the order, and latches the nearby and arrival thresholds so
 * each fires once. Writing the row directly skips all of it.
 */
export default new Action({
  name: 'Courier Ping Store',
  description: 'Record a position fix from the authenticated courier\'s device.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const session = await courierFromSession(request)
    if (session.error)
      return session.error

    const latitude = numeric(request.get('latitude'))
    const longitude = numeric(request.get('longitude'))

    if (latitude == null || latitude < -90 || latitude > 90)
      return invalid('latitude must be a number between -90 and 90')

    if (longitude == null || longitude < -180 || longitude > 180)
      return invalid('longitude must be a number between -180 and 180')

    const result = await shippings.tracking.recordCourierPing({
      courierId: session.courierId,
      latitude,
      longitude,
      heading: numeric(request.get('heading')),
      speed: numeric(request.get('speed')),
      accuracy: numeric(request.get('accuracy')),
      // The device's own clock. A phone that buffered fixes through a tunnel
      // sends them late, and stamping them with arrival time would draw the
      // courier teleporting.
      recordedAt: typeof request.get('recordedAt') === 'string' ? String(request.get('recordedAt')) : undefined,
    })

    return response.json(result)
  },
})

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '')
    return null

  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function invalid(message: string): Response {
  return response.json({ message }, 422)
}
