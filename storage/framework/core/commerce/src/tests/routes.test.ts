import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from './setup'
import { bulkDestroy } from '../shippings/delivery-routes/destroy'
import { fetchActive, fetchByCourier } from '../shippings/delivery-routes/fetch'
import { store, updateLastActive } from '../shippings/delivery-routes/store'

beforeEach(async () => {
  await refreshDatabase()
})

/**
 * A route belongs to a courier row.
 *
 * `courier` and `vehicle` on a route are denormalised copies that
 * `validateDeliveryRouteWrite` fills in from the courier it looks up — a route
 * cannot name a courier that does not exist, or claim a vehicle that courier is
 * not assigned. Passing them as input, which these tests used to do, has no
 * effect; `courier_id` is the real input.
 */
async function createCourier(name: string, vehicleNumber: string): Promise<number> {
  const courier = await db
    .insertInto('couriers')
    .values({
      name,
      phone: '555-0100',
      vehicle_number: vehicleNumber,
      license: `LIC-${vehicleNumber}`,
      status: 'active',
    })
    .returningAll()
    .executeTakeFirst()

  return Number((courier as { id: number }).id)
}

describe('Delivery Route Module', () => {
  describe('fetch', () => {
    it('should fetch routes by courier', async () => {
      // Two routes run by the same courier.
      const courierName = 'John Doe'
      const courierId = await createCourier(courierName, 'Truck A123')
      const routes = [
        {
          courier_id: courierId,
          stops: 5,
          delivery_time: 120,
          total_distance: 50,
        },
        {
          courier_id: courierId,
          stops: 3,
          delivery_time: 60,
          total_distance: 25,
        },
      ]

      // Store each route individually
      for (const routeData of routes) {
        const route = await store(routeData)
        expect(route.courier).toBe(courierName)
        expect(Number((route).last_active)).toBeGreaterThan(0)
      }

      const courierRoutes = await fetchByCourier(courierName)
      expect(courierRoutes.length).toBeGreaterThanOrEqual(2)
      expect(courierRoutes.every(route => route.courier === courierName)).toBe(true)

      const updated = await updateLastActive(Number(courierRoutes[0]?.id))
      expect(Number((updated).last_active)).toBeGreaterThan(0)
    })

    it('should normalize model attribute names to database columns', async () => {
      const route = await store({
        courier_id: await createCourier('Jane Doe', 'Van C789'),
        stops: 4,
        deliveryTime: 75,
        totalDistance: 31,
        lastActive: 1785360000000,
      })

      expect(Number((route).delivery_time)).toBe(75)
      expect(Number((route).total_distance)).toBe(31)
      expect(Number((route).last_active)).toBe(1785360000000)
    })

    it('should only fetch routes active within the last 24 hours', async () => {
      const now = Date.now()
      const recentRoute = await store({
        courier_id: await createCourier('Recent Courier', 'Van R100'),
        stops: 2,
        deliveryTime: 30,
        totalDistance: 12,
        lastActive: now - 60 * 60 * 1000,
      })
      const staleRoute = await store({
        courier_id: await createCourier('Stale Courier', 'Van S100'),
        stops: 1,
        deliveryTime: 20,
        totalDistance: 8,
        lastActive: now - 25 * 60 * 60 * 1000,
      })

      const activeRoutes = await fetchActive()
      const activeRouteIds = activeRoutes.map(route => Number(route.id))

      expect(activeRouteIds).toContain(Number(recentRoute.id))
      expect(activeRouteIds).not.toContain(Number(staleRoute.id))
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of routes', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
