import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy } from '../shippings/delivery-routes/destroy'
import { fetchActive, fetchByDriver } from '../shippings/delivery-routes/fetch'
import { store, updateLastActive } from '../shippings/delivery-routes/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Delivery Route Module', () => {
  describe('fetch', () => {
    it('should fetch routes by driver', async () => {
      // Create routes for the same driver
      const driverName = 'John Doe'
      const routes = [
        {
          driver: driverName,
          vehicle: 'Truck A123',
          stops: 5,
          delivery_time: 120,
          total_distance: 50,
        },
        {
          driver: driverName,
          vehicle: 'Van B456',
          stops: 3,
          delivery_time: 60,
          total_distance: 25,
        },
      ]

      // Store each route individually
      for (const routeData of routes) {
        const route = await store(routeData)
        expect(route.driver).toBe(driverName)
        expect(Number((route as any).last_active)).toBeGreaterThan(0)
      }

      const driverRoutes = await fetchByDriver(driverName)
      expect(driverRoutes.length).toBeGreaterThanOrEqual(2)
      expect(driverRoutes.every(route => route.driver === driverName)).toBe(true)

      const updated = await updateLastActive(Number(driverRoutes[0]?.id))
      expect(Number((updated as any).last_active)).toBeGreaterThan(0)
    })

    it('should normalize model attribute names to database columns', async () => {
      const route = await store({
        driver: 'Jane Doe',
        vehicle: 'Van C789',
        stops: 4,
        deliveryTime: 75,
        totalDistance: 31,
        lastActive: 1785360000000,
      })

      expect(Number((route as any).delivery_time)).toBe(75)
      expect(Number((route as any).total_distance)).toBe(31)
      expect(Number((route as any).last_active)).toBe(1785360000000)
    })

    it('should only fetch routes active within the last 24 hours', async () => {
      const now = Date.now()
      const recentRoute = await store({
        driver: 'Recent Driver',
        vehicle: 'Van R100',
        stops: 2,
        deliveryTime: 30,
        totalDistance: 12,
        lastActive: now - 60 * 60 * 1000,
      })
      const staleRoute = await store({
        driver: 'Stale Driver',
        vehicle: 'Van S100',
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
