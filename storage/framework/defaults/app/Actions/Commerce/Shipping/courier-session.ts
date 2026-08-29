import type { RequestInstance } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

export type CourierSessionResult =
  | { courierId: number, error?: never }
  | { courierId?: never, error: Response }

/**
 * The courier making this request.
 *
 * Resolved from the session, never from the body. A courier id accepted as
 * input would let any authenticated account post positions as somebody else -
 * moving another courier's marker on a customer's live map, and tripping their
 * arrival notifications.
 */
export async function courierFromSession(request: RequestInstance): Promise<CourierSessionResult> {
  const user = await request.user()
  if (!user)
    return { error: response.unauthorized('Authentication required') }

  const courier = await db
    .selectFrom('couriers')
    .where('user_id', '=', user.id)
    .select(['id'])
    .executeTakeFirst() as { id: number } | undefined

  if (!courier)
    return { error: response.forbidden('This account is not a courier') }

  return { courierId: Number(courier.id) }
}

/**
 * Check that a stop belongs to the run this courier is on.
 *
 * Stops are addressed by id, so without this any courier could complete or
 * fail another courier's delivery - which marks somebody else's order as
 * handed over.
 */
export async function assertStopBelongsToCourier(stopId: number, courierId: number): Promise<Response | null> {
  const row = await db
    .selectFrom('delivery_stops')
    .innerJoin('delivery_routes', 'delivery_routes.id', 'delivery_stops.delivery_route_id')
    .where('delivery_stops.id', '=', stopId)
    .select(['delivery_routes.courier_id as courier_id'])
    .executeTakeFirst() as { courier_id: number | null } | undefined

  if (!row)
    return response.json({ message: `DeliveryStop ${stopId} was not found.` }, 404)

  if (row.courier_id == null || Number(row.courier_id) !== courierId)
    return response.forbidden('This stop belongs to another courier')

  return null
}

/**
 * Check that a route is this courier's own.
 */
export async function assertRouteBelongsToCourier(routeId: number, courierId: number): Promise<Response | null> {
  const row = await db
    .selectFrom('delivery_routes')
    .where('id', '=', routeId)
    .select(['courier_id'])
    .executeTakeFirst() as { courier_id: number | null } | undefined

  if (!row)
    return response.json({ message: `DeliveryRoute ${routeId} was not found.` }, 404)

  if (row.courier_id == null || Number(row.courier_id) !== courierId)
    return response.forbidden('This route belongs to another courier')

  return null
}
