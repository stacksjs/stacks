import type { Coordinates } from './geo'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import {
  emitDeliveryArrived,
  emitDeliveryNearby,
  emitDeliveryPosition,
} from './events'
import {
  bearingInDegrees,
  distanceInMeters,
  estimateSecondsRemaining,
  hasCoordinates,
} from './geo'

/**
 * Driver position ingest.
 *
 * One entry point for "the driver's device says it is here". Everything that
 * has to happen on a fix happens here, in one place, because splitting it
 * across the route handler and a listener is how a tracking page ends up
 * showing a position that the ETA disagrees with:
 *
 *   1. Append to the `driver_pings` series.
 *   2. Update the driver's denormalised present position.
 *   3. Recompute distance and ETA for the stop being served.
 *   4. Push position to everyone watching (broadcast only).
 *   5. Raise `delivery:nearby` and `delivery:arrived` on threshold crossings,
 *      exactly once each.
 */

/** Within this many metres of the destination, the customer is told to expect the door. */
export const NEARBY_RADIUS_METERS = 400

/** Within this, the driver is treated as arrived. */
export const ARRIVAL_RADIUS_METERS = 60

export interface DriverPingInput extends Coordinates {
  driverId: number
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
  /** Device clock, ISO 8601. Defaults to now when the device does not say. */
  recordedAt?: string
}

export interface DriverPingResult {
  pingId: number | null
  routeId: number | null
  stopId: number | null
  distanceToStopMeters: number | null
  etaSeconds: number | null
  crossedNearby: boolean
  crossedArrival: boolean
}

/**
 * A fix this inaccurate is noise. Accepting it drags the marker across the
 * street and back, and worse, can trip the arrival radius from a block away.
 * The ping is still stored (the history should record that the device was
 * uncertain) but it does not move the driver or fire thresholds.
 */
const MAX_TRUSTED_ACCURACY_METERS = 250

export async function recordDriverPing(input: DriverPingInput): Promise<DriverPingResult> {
  const recordedAt = input.recordedAt ?? new Date().toISOString()
  const trusted = typeof input.accuracy !== 'number' || input.accuracy <= MAX_TRUSTED_ACCURACY_METERS

  const driver = await db
    .selectFrom('drivers')
    .where('id', '=', input.driverId)
    .select(['id', 'latitude', 'longitude'])
    .executeTakeFirst() as { id: number, latitude: number | null, longitude: number | null } | undefined

  if (!driver)
    throw new Error(`Unknown driver: ${input.driverId}`)

  // The device usually reports heading; when it does not, derive it from the
  // last fix so the map marker still points along the direction of travel.
  const previous = hasCoordinates(driver as Partial<Coordinates>)
    ? { latitude: driver.latitude as number, longitude: driver.longitude as number }
    : null
  const heading = typeof input.heading === 'number'
    ? input.heading
    : previous
      ? bearingInDegrees(previous, input)
      : null

  const route = await activeRouteForDriver(input.driverId)
  const stop = route ? await currentStopForRoute(route.id) : null

  let distanceToStopMeters: number | null = null
  let etaSeconds: number | null = null
  let crossedNearby = false
  let crossedArrival = false

  const stopPosition = stop && hasCoordinates({ latitude: stop.latitude ?? undefined, longitude: stop.longitude ?? undefined })
    ? { latitude: stop.latitude as number, longitude: stop.longitude as number }
    : null

  if (trusted && stop && stopPosition) {
    distanceToStopMeters = Math.round(distanceInMeters(input, stopPosition))
    etaSeconds = estimateSecondsRemaining(distanceToStopMeters, input.speed ?? 0)

    // Thresholds fire once. `arrived_at` and the `en_route` → `arrived`
    // transition are the latches: without them every subsequent ping inside
    // the radius sends the customer another "your driver is nearby" text.
    crossedArrival = distanceToStopMeters <= ARRIVAL_RADIUS_METERS && stop.arrived_at == null
    crossedNearby = !crossedArrival
      && distanceToStopMeters <= NEARBY_RADIUS_METERS
      && stop.status === 'en_route'
      && stop.notified_nearby_at == null
  }

  const pingId = await insertPing({
    driverId: input.driverId,
    routeId: route?.id ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    heading,
    speed: input.speed ?? null,
    accuracy: input.accuracy ?? null,
    recordedAt,
  })

  if (trusted) {
    await db
      .updateTable('drivers')
      .set({
        latitude: input.latitude,
        longitude: input.longitude,
        heading,
        speed: input.speed ?? 0,
        last_ping_at: recordedAt,
      })
      .where('id', '=', input.driverId)
      .execute()
  }

  if (stop && (distanceToStopMeters != null || etaSeconds != null)) {
    await db
      .updateTable('delivery_stops')
      .set({ eta_at: etaSeconds == null ? stop.eta_at : new Date(Date.now() + etaSeconds * 1000).toISOString() })
      .where('id', '=', stop.id)
      .execute()
  }

  // Position goes out on every trusted fix, to the order being served and to
  // the route dashboard. A ping with no active stop still moves the vehicle on
  // the dispatch map, so it broadcasts with an empty order list.
  if (trusted) {
    await emitDeliveryPosition(stop?.order_id == null ? [] : [stop.order_id], route?.id ?? null, {
      driverId: input.driverId,
      routeId: route?.id ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      heading,
      speed: input.speed ?? null,
      accuracy: input.accuracy ?? null,
      recordedAt,
      distanceToStopMeters,
      etaSeconds,
    })
  }

  if (crossedNearby && stop) {
    await db
      .updateTable('delivery_stops')
      .set({ notified_nearby_at: recordedAt })
      .where('id', '=', stop.id)
      .execute()

    await emitDeliveryNearby(stop as unknown as Record<string, unknown>, distanceToStopMeters as number, etaSeconds)
  }

  if (crossedArrival && stop) {
    await db
      .updateTable('delivery_stops')
      .set({ status: 'arrived', arrived_at: recordedAt })
      .where('id', '=', stop.id)
      .execute()

    await emitDeliveryArrived({ ...stop, status: 'arrived', arrived_at: recordedAt } as unknown as Record<string, unknown>)
  }

  return {
    pingId,
    routeId: route?.id ?? null,
    stopId: stop?.id ?? null,
    distanceToStopMeters,
    etaSeconds,
    crossedNearby,
    crossedArrival,
  }
}

interface StopRow {
  id: number
  order_id: number | null
  status: string
  latitude: number | null
  longitude: number | null
  eta_at: string | null
  arrived_at: string | null
  notified_nearby_at: string | null
}

/** The route this driver is currently running, if any. */
async function activeRouteForDriver(driverId: number): Promise<{ id: number } | null> {
  const row = await db
    .selectFrom('delivery_routes')
    .where('driver_id', '=', driverId)
    .where('status', '=', 'active')
    .select(['id'])
    .orderBy('id', 'desc')
    .executeTakeFirst() as { id: number } | undefined

  return row ?? null
}

/**
 * The stop being served: the first one still open, in planned order.
 *
 * `en_route` before `pending` so a driver who skipped ahead is tracked against
 * the stop they actually declared, not the one the plan says is next.
 */
async function currentStopForRoute(routeId: number): Promise<StopRow | null> {
  const rows = await db
    .selectFrom('delivery_stops')
    .where('delivery_route_id', '=', routeId)
    .where('status', 'in', ['en_route', 'pending', 'arrived'])
    .select(['id', 'order_id', 'status', 'latitude', 'longitude', 'eta_at', 'arrived_at', 'notified_nearby_at'])
    .orderBy('sequence', 'asc')
    .execute() as unknown as StopRow[]

  return rows.find(row => row.status === 'en_route')
    ?? rows.find(row => row.status === 'arrived')
    ?? rows[0]
    ?? null
}

async function insertPing(values: {
  driverId: number
  routeId: number | null
  latitude: number
  longitude: number
  heading: number | null
  speed: number | null
  accuracy: number | null
  recordedAt: string
}): Promise<number | null> {
  const uuid = randomUUIDv7()

  await db
    .insertInto('driver_pings')
    .values({
      uuid,
      driver_id: values.driverId,
      delivery_route_id: values.routeId,
      latitude: values.latitude,
      longitude: values.longitude,
      heading: values.heading,
      speed: values.speed ?? 0,
      accuracy: values.accuracy,
      recorded_at: values.recordedAt,
    })
    .executeTakeFirst()

  const row = await db
    .selectFrom('driver_pings')
    .where('uuid', '=', uuid)
    .select(['id'])
    .executeTakeFirst() as { id: number } | undefined

  return row?.id ?? null
}
