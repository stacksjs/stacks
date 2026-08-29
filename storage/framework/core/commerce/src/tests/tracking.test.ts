import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from './setup'
import { ARRIVAL_RADIUS_METERS, NEARBY_RADIUS_METERS, recordCourierPing } from '../shippings/tracking/ping'
import { assignStop, completeStop, failStop, startRoute, startStop } from '../shippings/tracking/stops'

// A dropoff in central London, and points at known distances from it.
const DROPOFF = { latitude: 51.5074, longitude: -0.1278 }

/**
 * A point `metres` due north of the dropoff. One degree of latitude is ~111.32km
 * anywhere, so north is the axis that needs no cosine correction.
 */
function northOf(metres: number): { latitude: number, longitude: number } {
  return { latitude: DROPOFF.latitude + metres / 111_320, longitude: DROPOFF.longitude }
}

async function makeCourier(): Promise<number> {
  await db.insertInto('couriers').values({
    uuid: crypto.randomUUID(),
    name: 'Test Courier',
    phone: '+15550000000',
    vehicle_number: 'VAN-1',
    license: 'L-1',
    status: 'active',
  }).executeTakeFirst()

  const row = await db.selectFrom('couriers').select(['id']).orderBy('id', 'desc').executeTakeFirst() as { id: number }
  return Number(row.id)
}

async function makeRoute(courierId: number): Promise<number> {
  await db.insertInto('delivery_routes').values({
    uuid: crypto.randomUUID(),
    courier_id: courierId,
    courier: 'Test Courier',
    vehicle: 'VAN-1',
    stops: 1,
    delivery_time: 30,
    total_distance: 5,
    last_active: 0,
    status: 'planned',
  }).executeTakeFirst()

  const row = await db.selectFrom('delivery_routes').select(['id']).orderBy('id', 'desc').executeTakeFirst() as { id: number }
  return Number(row.id)
}

async function makeOrder(status = 'PROCESSING'): Promise<number> {
  await db.insertInto('orders').values({
    uuid: crypto.randomUUID(),
    status,
    total_amount: 1000,
    order_type: 'DELIVERY',
    delivery_address: '1 Test Street',
  } as never).executeTakeFirst()

  const row = await db.selectFrom('orders').select(['id']).orderBy('id', 'desc').executeTakeFirst() as { id: number }
  return Number(row.id)
}

async function orderStatus(orderId: number): Promise<string> {
  const row = await db.selectFrom('orders').where('id', '=', orderId).select(['status']).executeTakeFirst() as { status: string }
  return row.status
}

async function stopRow(stopId: number): Promise<Record<string, unknown>> {
  return await db.selectFrom('delivery_stops').where('id', '=', stopId).selectAll().executeTakeFirst() as Record<string, unknown>
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('Courier tracking', () => {
  describe('recordCourierPing', () => {
    it('rejects a ping from a courier that does not exist', async () => {
      await expect(recordCourierPing({ courierId: 999_999, ...DROPOFF })).rejects.toThrow(/Unknown courier/)
    })

    it('moves the courier to the reported position', async () => {
      const courierId = await makeCourier()

      await recordCourierPing({ courierId, ...DROPOFF })

      const courier = await db.selectFrom('couriers').where('id', '=', courierId)
        .select(['latitude', 'longitude']).executeTakeFirst() as { latitude: number, longitude: number }

      expect(Number(courier.latitude)).toBeCloseTo(DROPOFF.latitude, 4)
      expect(Number(courier.longitude)).toBeCloseTo(DROPOFF.longitude, 4)
    })

    it('stores an inaccurate fix but does not move the courier with it', async () => {
      const courierId = await makeCourier()
      await recordCourierPing({ courierId, ...DROPOFF })

      // 2km of reported error. Trusting it would drag the marker across the
      // city and could trip arrival from streets away.
      const result = await recordCourierPing({ courierId, ...northOf(5000), accuracy: 2000 })

      expect(result.pingId).not.toBeNull()

      const courier = await db.selectFrom('couriers').where('id', '=', courierId)
        .select(['latitude']).executeTakeFirst() as { latitude: number }
      expect(Number(courier.latitude)).toBeCloseTo(DROPOFF.latitude, 4)
    })

    it('crosses nearby once, then stops reporting it', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder()
      const stop = await assignStop({ deliveryRouteId: routeId, orderId, address: '1 Test Street', ...DROPOFF })
      await startRoute(routeId)
      await startStop(Number(stop.id))

      const inside = northOf(NEARBY_RADIUS_METERS - 100)
      const first = await recordCourierPing({ courierId, ...inside })
      const second = await recordCourierPing({ courierId, ...inside })

      expect(first.crossedNearby).toBe(true)
      // Without the latch this fires again on every fix, which is a text
      // message every few seconds for the last stretch of the journey.
      expect(second.crossedNearby).toBe(false)
    })

    it('crosses arrival once and latches arrived_at', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder()
      const stop = await assignStop({ deliveryRouteId: routeId, orderId, address: '1 Test Street', ...DROPOFF })
      await startRoute(routeId)
      await startStop(Number(stop.id))

      const atDoor = northOf(ARRIVAL_RADIUS_METERS - 20)
      const first = await recordCourierPing({ courierId, ...atDoor })
      const second = await recordCourierPing({ courierId, ...atDoor })

      expect(first.crossedArrival).toBe(true)
      expect(second.crossedArrival).toBe(false)
      expect((await stopRow(Number(stop.id))).arrived_at).not.toBeNull()
    })
  })

  describe('pickup and dropoff legs', () => {
    it('starting a pickup leaves the order where it is', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder('PROCESSING')
      const pickup = await assignStop({
        deliveryRouteId: routeId,
        orderId,
        address: 'The Restaurant',
        type: 'pickup',
        ...DROPOFF,
      })

      await startStop(Number(pickup.id))

      // Driving to the restaurant is not the customer's order being on its way.
      expect(await orderStatus(orderId)).toBe('PROCESSING')
    })

    it('completing a pickup puts the order out for delivery, not delivered', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder('PROCESSING')
      const pickup = await assignStop({
        deliveryRouteId: routeId,
        orderId,
        address: 'The Restaurant',
        type: 'pickup',
        ...DROPOFF,
      })

      await completeStop(Number(pickup.id))

      expect(await orderStatus(orderId)).toBe('OUT_FOR_DELIVERY')
    })

    it('completing the dropoff delivers the order', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder('OUT_FOR_DELIVERY')
      const dropoff = await assignStop({ deliveryRouteId: routeId, orderId, address: '1 Test Street', ...DROPOFF })

      await completeStop(Number(dropoff.id))

      expect(await orderStatus(orderId)).toBe('DELIVERED')
    })

    it('a failed pickup leaves the order with the merchant', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder('PROCESSING')
      const pickup = await assignStop({
        deliveryRouteId: routeId,
        orderId,
        address: 'The Restaurant',
        type: 'pickup',
        ...DROPOFF,
      })

      await failStop(Number(pickup.id), 'restaurant closed')

      // SHIPPED would claim it left a building it never left.
      expect(await orderStatus(orderId)).toBe('PROCESSING')
    })

    it('a failed dropoff sends the order back to the depot', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const orderId = await makeOrder('OUT_FOR_DELIVERY')
      const dropoff = await assignStop({ deliveryRouteId: routeId, orderId, address: '1 Test Street', ...DROPOFF })

      await failStop(Number(dropoff.id), 'nobody home')

      expect(await orderStatus(orderId)).toBe('SHIPPED')
    })

    it('defaults a stop with no declared type to dropoff', async () => {
      const courierId = await makeCourier()
      const routeId = await makeRoute(courierId)
      const stop = await assignStop({ deliveryRouteId: routeId, address: '1 Test Street', ...DROPOFF })

      expect((await stopRow(Number(stop.id))).type).toBe('dropoff')
    })
  })
})
