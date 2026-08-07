import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import {
  emitDeliveryAssigned,
  emitDeliveryCompleted,
  emitDeliveryFailed,
  emitDeliveryStarted,
} from './events'

/**
 * Stop lifecycle.
 *
 * Every state change a driver makes goes through one of these, so the order's
 * status, the stop's timestamps and the outgoing events stay in step. Writing
 * `delivery_stops.status` directly works and is how a tracking page ends up
 * saying "out for delivery" about an order that was delivered ten minutes ago.
 *
 * The order status is kept in lockstep on purpose: `OUT_FOR_DELIVERY` and
 * `DELIVERED` are the two states a customer actually sees, and they mean the
 * same thing as the stop being `en_route` and `completed`.
 */

export interface AssignStopInput {
  deliveryRouteId: number
  orderId?: number | null
  sequence?: number
  address: string
  latitude?: number | null
  longitude?: number | null
  recipientName?: string | null
  recipientPhone?: string | null
  etaAt?: string | null
}

/** Put an order on a route. */
export async function assignStop(input: AssignStopInput): Promise<Record<string, unknown>> {
  const uuid = randomUUIDv7()
  const sequence = input.sequence ?? await nextSequence(input.deliveryRouteId)

  await db
    .insertInto('delivery_stops')
    .values({
      uuid,
      delivery_route_id: input.deliveryRouteId,
      order_id: input.orderId ?? null,
      sequence,
      status: 'pending',
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recipient_name: input.recipientName ?? null,
      recipient_phone: input.recipientPhone ?? null,
      eta_at: input.etaAt ?? null,
    })
    .executeTakeFirst()

  const stop = await stopByUuid(uuid)
  if (stop)
    await emitDeliveryAssigned(stop)

  return stop ?? {}
}

/**
 * The driver is now driving to this stop.
 *
 * Also moves the order to OUT_FOR_DELIVERY, which is the state the customer's
 * tracking page and notifications key on.
 */
export async function startStop(stopId: number): Promise<Record<string, unknown> | null> {
  await db
    .updateTable('delivery_stops')
    .set({ status: 'en_route' })
    .where('id', '=', stopId)
    .execute()

  const stop = await stopById(stopId)
  if (!stop)
    return null

  if (stop.order_id != null)
    await setOrderStatus(stop.order_id as number, 'OUT_FOR_DELIVERY')

  await emitDeliveryStarted(stop)

  return stop
}

/** Handover done. Completes the stop and marks the order delivered. */
export async function completeStop(stopId: number, notes?: string): Promise<Record<string, unknown> | null> {
  const completedAt = new Date().toISOString()

  await db
    .updateTable('delivery_stops')
    .set({
      status: 'completed',
      completed_at: completedAt,
      // A driver who completes without the arrival radius ever tripping (GPS
      // off, indoors, a handover in a car park) still arrived. Backfill rather
      // than leave a completed stop that was never reached.
      ...(await hasArrived(stopId) ? {} : { arrived_at: completedAt }),
      ...(notes ? { notes } : {}),
    })
    .where('id', '=', stopId)
    .execute()

  const stop = await stopById(stopId)
  if (!stop)
    return null

  if (stop.order_id != null)
    await setOrderStatus(stop.order_id as number, 'DELIVERED')

  await emitDeliveryCompleted(stop)
  await closeRouteIfDone(stop.delivery_route_id as number)

  return stop
}

/**
 * The stop could not be completed.
 *
 * The order goes back to SHIPPED rather than staying OUT_FOR_DELIVERY: it is
 * on its way back to the depot, and a customer watching a map should not be
 * told a vehicle is still coming.
 */
export async function failStop(stopId: number, reason: string): Promise<Record<string, unknown> | null> {
  await db
    .updateTable('delivery_stops')
    .set({ status: 'failed', notes: reason })
    .where('id', '=', stopId)
    .execute()

  const stop = await stopById(stopId)
  if (!stop)
    return null

  if (stop.order_id != null)
    await setOrderStatus(stop.order_id as number, 'SHIPPED')

  await emitDeliveryFailed(stop, reason)
  await closeRouteIfDone(stop.delivery_route_id as number)

  return stop
}

/** Start a route. Until this runs, pings from its driver find no active route. */
export async function startRoute(routeId: number): Promise<void> {
  await db
    .updateTable('delivery_routes')
    .set({ status: 'active', started_at: new Date().toISOString() })
    .where('id', '=', routeId)
    .execute()
}

/**
 * Close a route once nothing is left open on it.
 *
 * Called after every terminal stop transition so a driver never has to
 * remember to end their shift for the dispatch map to stop showing them as
 * out on a run.
 */
async function closeRouteIfDone(routeId: number | null | undefined): Promise<void> {
  if (routeId == null)
    return

  const open = await db
    .selectFrom('delivery_stops')
    .where('delivery_route_id', '=', routeId)
    .where('status', 'in', ['pending', 'en_route', 'arrived'])
    .select(['id'])
    .executeTakeFirst()

  if (open)
    return

  const route = await db
    .selectFrom('delivery_routes')
    .where('id', '=', routeId)
    .select(['driver_id'])
    .executeTakeFirst() as { driver_id: number | null } | undefined

  await db
    .updateTable('delivery_routes')
    .set({ status: 'completed', completed_at: new Date().toISOString() })
    .where('id', '=', routeId)
    .execute()

  // Hand the driver back. Leaving them `on_delivery` after their last stop is
  // how a dispatch board ends up showing a van out on a run that finished
  // hours ago.
  if (route?.driver_id != null) {
    await db
      .updateTable('drivers')
      .set({ status: 'active' })
      .where('id', '=', route.driver_id)
      .execute()
  }
}

/**
 * Move an order's status and fire the matching order event.
 *
 * Guarded by `canTransition`, so a duplicate "completed" tap from a driver's
 * phone cannot walk DELIVERED backwards.
 *
 * When the jump is not legal in one hop it walks the intermediate state rather
 * than giving up. Dispatching a freshly placed order is the case that matters:
 * an order sits at PENDING until someone accepts it, and PENDING to
 * OUT_FOR_DELIVERY is not a legal edge, so a silent refusal left the delivery
 * running while the customer's order still read "pending". Loading it onto a
 * vehicle IS the accept, so the missing PROCESSING hop is taken here, events
 * and all.
 *
 * Only one intermediate hop is ever taken. Anything further apart than that is
 * a genuine illegal transition and stays refused, loudly.
 */
async function setOrderStatus(orderId: number, next: string): Promise<void> {
  const order = await db
    .selectFrom('orders')
    .where('id', '=', orderId)
    .select(['id', 'status'])
    .executeTakeFirst() as { id: number, status: string } | undefined

  if (!order)
    return

  const events = await import('../../orders/events')
  const { canTransition, emitForStatus } = events

  const path = transitionPath(order.status, next, canTransition)
  if (path.length === 0) {
    const { log } = await import('@stacksjs/logging').catch(() => ({ log: null })) as { log: { warn: (m: string) => void } | null }
    log?.warn(`[delivery] refused to move order ${orderId} from ${order.status} to ${next}: no legal transition`)
    return
  }

  for (const step of path) {
    await db
      .updateTable('orders')
      .set({ status: step })
      .where('id', '=', orderId)
      .execute()

    await emitForStatus(step as never, { ...order, status: step })
  }
}

/**
 * The states to pass through to get from `from` to `to`, or an empty array
 * when there is no route of at most two hops.
 */
function transitionPath(
  from: string,
  to: string,
  canTransition: (a: never, b: never) => boolean,
): string[] {
  if (from === to)
    return []

  if (canTransition(from as never, to as never))
    return [to]

  // One intermediate hop. PROCESSING first, because "accepted and being
  // prepared" is the step a storefront order actually skips.
  for (const middle of ['PROCESSING', 'SHIPPED']) {
    if (middle === from || middle === to)
      continue

    if (canTransition(from as never, middle as never) && canTransition(middle as never, to as never))
      return [middle, to]
  }

  return []
}

async function nextSequence(routeId: number): Promise<number> {
  const rows = await db
    .selectFrom('delivery_stops')
    .where('delivery_route_id', '=', routeId)
    .select(['sequence'])
    .execute() as { sequence: number }[]

  return rows.reduce((max, row) => Math.max(max, row.sequence ?? 0), 0) + 1
}

async function hasArrived(stopId: number): Promise<boolean> {
  const row = await db
    .selectFrom('delivery_stops')
    .where('id', '=', stopId)
    .select(['arrived_at'])
    .executeTakeFirst() as { arrived_at: string | null } | undefined

  return row?.arrived_at != null
}

async function stopById(id: number): Promise<Record<string, unknown> | null> {
  const row = await db
    .selectFrom('delivery_stops')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return (row as Record<string, unknown>) ?? null
}

async function stopByUuid(uuid: string): Promise<Record<string, unknown> | null> {
  const row = await db
    .selectFrom('delivery_stops')
    .where('uuid', '=', uuid)
    .selectAll()
    .executeTakeFirst()

  return (row as Record<string, unknown>) ?? null
}
