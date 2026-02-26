import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../shippings/delivery-routes/destroy'
import { fetchByDriver } from '../shippings/delivery-routes/fetch'
import { store } from '../shippings/delivery-routes/store'

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
        await store(routeData)
      }

      const driverRoutes = await fetchByDriver(driverName)
      expect(driverRoutes.length).toBeGreaterThanOrEqual(2)
      expect(driverRoutes.every(route => route.driver === driverName)).toBe(true)
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
