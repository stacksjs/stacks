import { route } from '@stacksjs/router'

/**
 * Courier-facing delivery endpoints.
 *
 * The tracking pipeline in `@stacksjs/commerce` has always been able to ingest
 * a position, recompute an ETA and broadcast it - it just had no way in from a
 * device. These are that way in.
 *
 * Every route authorises against the courier the session belongs to, not
 * against an id in the body, so one courier cannot post positions or complete
 * stops as another. `CourierPing` deliberately has no `useApi` surface: the
 * generated CRUD would let a client write the ping row directly and skip the
 * position update, ETA recompute, broadcast and arrival latching that make a
 * ping mean anything.
 */

route.post('/delivery/pings', 'Actions/Commerce/Shipping/CourierPingStoreAction')

route.post('/delivery/routes/{id}/start', 'Actions/Commerce/Shipping/DeliveryRouteStartAction')

route.post('/delivery/stops/{id}/start', 'Actions/Commerce/Shipping/DeliveryStopStartAction')
route.post('/delivery/stops/{id}/complete', 'Actions/Commerce/Shipping/DeliveryStopCompleteAction')
route.post('/delivery/stops/{id}/fail', 'Actions/Commerce/Shipping/DeliveryStopFailAction')
