/**
 * Live delivery tracking.
 *
 * `couriers` and `delivery-routes` are CRUD over the records. This is the part
 * that moves: position ingest, the stop lifecycle, the geodesy the ETA is
 * derived from, and the two fan-outs (event bus for the application, realtime
 * channel for the browser).
 */

export {
  broadcastToChannel,
  emitDeliveryArrived,
  emitDeliveryAssigned,
  emitDeliveryCompleted,
  emitDeliveryFailed,
  emitDeliveryNearby,
  emitDeliveryPosition,
  emitDeliveryStarted,
  orderTrackingChannel,
  routeTrackingChannel,
} from './events'
export type { DeliveryPositionPayload } from './events'

export {
  bearingInDegrees,
  distanceInMeters,
  estimateSecondsRemaining,
  hasCoordinates,
  isWithin,
} from './geo'
export type { Coordinates } from './geo'

export {
  ARRIVAL_RADIUS_METERS,
  NEARBY_RADIUS_METERS,
  recordCourierPing,
} from './ping'
export type { CourierPingInput, CourierPingResult } from './ping'

export {
  assignStop,
  completeStop,
  failStop,
  startRoute,
  startStop,
} from './stops'
export type { AssignStopInput } from './stops'
