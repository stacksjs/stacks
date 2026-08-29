/**
 * Delivery tracking events, and the live channel behind them.
 *
 * Two fan-outs, deliberately separate:
 *
 *   - The **event bus** (`@stacksjs/events`) is for the application: send the
 *     SMS, write the notification row, update analytics. Listeners run
 *     server-side and can be slow.
 *   - The **broadcast channel** (`@stacksjs/realtime`) is for the browser
 *     holding the tracking page open. It carries position at whatever rate
 *     the courier's device reports, which is far too often to put through the
 *     notification path.
 *
 * A position update takes the second path only. A state change (assigned,
 * out for delivery, nearby, arrived, completed) takes both.
 *
 * Both are lazy-imported and both swallow their own failures: a delivery is
 * not allowed to fail because a websocket server is down.
 */

import type { Coordinates } from './geo'

/** Channel a customer's tracking page subscribes to, keyed on the order. */
export function orderTrackingChannel(orderId: number | string): string {
  return `order.${orderId}`
}

/** Channel the dispatch dashboard subscribes to for a whole route. */
export function routeTrackingChannel(routeId: number | string): string {
  return `delivery-route.${routeId}`
}

export interface DeliveryPositionPayload extends Coordinates, Record<string, unknown> {
  courierId: number
  routeId?: number | null
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
  recordedAt: string
  /** Metres to the stop being served, when there is one. */
  distanceToStopMeters?: number | null
  /** Seconds, or null when the courier is stationary. */
  etaSeconds?: number | null
}

/**
 * Best-effort dispatch onto the application event bus.
 *
 * Mirrors `orders/events.ts`: the bus is a side-channel, so a missing package
 * or a throwing listener must not surface to the caller.
 */
async function emitEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const mod = await import('@stacksjs/events').catch(() => null)
    if (!mod)
      return

    const dispatch = (mod as { dispatch?: (t: string, p: unknown) => void }).dispatch
    if (typeof dispatch !== 'function')
      return

    dispatch(eventName, payload)
  }
  catch {
    // Swallow. See the note above.
  }
}

/**
 * Best-effort broadcast to a realtime channel.
 *
 * Private rather than public: the payload is a named customer's address and a
 * courier's live position. Authorisation happens in the app's websocket
 * authenticator (`setWsAuthenticator`), which is where the tracking token is
 * checked.
 */
export async function broadcastToChannel(
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const mod = await import('@stacksjs/realtime').catch(() => null)
    if (!mod)
      return

    const channel = (mod as { channel?: (name: string) => { broadcast: (e: string, d?: unknown, t?: string) => Promise<void> } }).channel
    if (typeof channel !== 'function')
      return

    await channel(channelName).broadcast(event, payload, 'private')
  }
  catch {
    // A tracking page that stops updating is a degraded experience. A ping
    // that fails to persist because the socket server is unreachable is a
    // lost delivery. Only the first of those is acceptable.
  }
}

/**
 * A courier moved.
 *
 * Broadcast only — this fires several times a minute per active delivery and
 * has no business waking every event listener in the application.
 */
export async function emitDeliveryPosition(
  orderIds: readonly (number | string)[],
  routeId: number | null | undefined,
  payload: DeliveryPositionPayload,
): Promise<void> {
  await Promise.all([
    ...orderIds.map(orderId => broadcastToChannel(orderTrackingChannel(orderId), 'delivery:position', payload)),
    routeId == null
      ? Promise.resolve()
      : broadcastToChannel(routeTrackingChannel(routeId), 'delivery:position', payload),
  ])
}

/** A stop was assigned to a route and a courier. Both paths. */
export async function emitDeliveryAssigned(stop: Record<string, unknown>): Promise<void> {
  await emitEvent('delivery:assigned', { stop })
  if (stop.order_id != null)
    await broadcastToChannel(orderTrackingChannel(stop.order_id as number), 'delivery:assigned', { stop })
}

/** The vehicle left with this order on it. Both paths. */
export async function emitDeliveryStarted(stop: Record<string, unknown>): Promise<void> {
  await emitEvent('delivery:started', { stop })
  if (stop.order_id != null)
    await broadcastToChannel(orderTrackingChannel(stop.order_id as number), 'delivery:started', { stop })
}

/**
 * The courier came within the "nearly there" radius.
 *
 * The event worth sending an SMS for, and the reason the whole ingest path
 * computes distance per ping rather than leaving it to the client.
 */
export async function emitDeliveryNearby(
  stop: Record<string, unknown>,
  distanceMeters: number,
  etaSeconds: number | null,
): Promise<void> {
  await emitEvent('delivery:nearby', { stop, distanceMeters, etaSeconds })
  if (stop.order_id != null)
    await broadcastToChannel(orderTrackingChannel(stop.order_id as number), 'delivery:nearby', { stop, distanceMeters, etaSeconds })
}

/** The courier reached the address. Both paths. */
export async function emitDeliveryArrived(stop: Record<string, unknown>): Promise<void> {
  await emitEvent('delivery:arrived', { stop })
  if (stop.order_id != null)
    await broadcastToChannel(orderTrackingChannel(stop.order_id as number), 'delivery:arrived', { stop })
}

/** Handover done. Both paths. */
export async function emitDeliveryCompleted(stop: Record<string, unknown>): Promise<void> {
  await emitEvent('delivery:completed', { stop })
  if (stop.order_id != null)
    await broadcastToChannel(orderTrackingChannel(stop.order_id as number), 'delivery:completed', { stop })
}

/** The stop could not be completed. Event bus only; there is no live view to update. */
export async function emitDeliveryFailed(stop: Record<string, unknown>, reason?: string): Promise<void> {
  await emitEvent('delivery:failed', { stop, reason })
}
