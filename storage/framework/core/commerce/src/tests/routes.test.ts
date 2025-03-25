import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete, destroy, softDelete } from '../routes/destroy'
import { fetchAll, fetchById, fetchActive, fetchByDriver } from '../routes/fetch'
import { bulkStore, store, updateLastActive } from '../routes/store'
import { update, updateStops, updateMetrics } from '../routes/update'

// Create a request-like object for testing
class TestRequest {
  private data: Record<string, any> = {}

  constructor(data: Record<string, any>) {
    this.data = data
  }

  validate() {
    return Promise.resolve()
  }

  get<T = any>(key: string): T {
    return this.data[key] as T
  }

  has(key: string): boolean {
    return key in this.data
  }
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('Delivery Route Module', () => {
  describe('store', () => {
    it('should create a new delivery route in the database', async () => {
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
        last_active: new Date().toISOString(),
      }

      const request = new TestRequest(requestData)
      const route = await store(request as any)

      expect(route).toBeDefined()
      expect(route?.driver).toBe('John Doe')
      expect(route?.vehicle).toBe('Truck A123')
      expect(route?.stops).toBe(5)
      expect(route?.delivery_time).toBe(120)
      expect(route?.total_distance).toBe(50)
      expect(route?.last_active).toBeDefined()
      expect(route?.uuid).toBeDefined()

      // Save the ID for further testing
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      // Verify we can fetch the route we just created
      if (routeId) {
        const fetchedRoute = await fetchById(routeId)
        expect(fetchedRoute).toBeDefined()
        expect(fetchedRoute?.id).toBe(routeId)
      }
    })

    it('should create a delivery route with minimal required fields', async () => {
      const minimalRequestData = {
        driver: 'Jane Smith',
        vehicle: 'Van B456',
        stops: 3,
        delivery_time: 60,
        total_distance: 25,
      }

      const request = new TestRequest(minimalRequestData)
      const route = await store(request as any)

      expect(route).toBeDefined()
      expect(route?.driver).toBe('Jane Smith')
      expect(route?.vehicle).toBe('Van B456')
      expect(route?.stops).toBe(3)
      expect(route?.delivery_time).toBe(60)
      expect(route?.total_distance).toBe(25)
      expect(route?.last_active).toBeUndefined()
      expect(route?.uuid).toBeDefined()
    })

    it('should create multiple delivery routes with bulk store', async () => {
      const requests = [
        new TestRequest({
          driver: 'John Doe',
          vehicle: 'Truck A123',
          stops: 5,
          delivery_time: 120,
          total_distance: 50,
        }),
        new TestRequest({
          driver: 'Jane Smith',
          vehicle: 'Van B456',
          stops: 3,
          delivery_time: 60,
          total_distance: 25,
        }),
        new TestRequest({
          driver: 'Bob Wilson',
          vehicle: 'Car C789',
          stops: 2,
          delivery_time: 30,
          total_distance: 15,
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify routes can be fetched
      const allRoutes = await fetchAll()
      expect(allRoutes.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing delivery route', async () => {
      // First create a route to update
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
      }

      // Create the route
      const createRequest = new TestRequest(requestData)
      const route = await store(createRequest as any)
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      // Make sure we have a valid route ID before proceeding
      expect(routeId).toBeDefined()
      if (!routeId) {
        throw new Error('Failed to create test delivery route')
      }

      // Update the route with new data
      const updateData = {
        driver: 'John Smith',
        vehicle: 'Truck A456',
        stops: 6,
        delivery_time: 150,
        total_distance: 75,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedRoute = await update(routeId, updateRequest as any)

      // Verify the update was successful
      expect(updatedRoute).toBeDefined()
      expect(updatedRoute?.id).toBe(routeId)
      expect(updatedRoute?.driver).toBe('John Smith')
      expect(updatedRoute?.vehicle).toBe('Truck A456')
      expect(updatedRoute?.stops).toBe(6)
      expect(updatedRoute?.delivery_time).toBe(150)
      expect(updatedRoute?.total_distance).toBe(75)
    })

    it('should update a route\'s stops count', async () => {
      // Create a route
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
      }

      const request = new TestRequest(requestData)
      const route = await store(request as any)
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      // Make sure we have a valid route ID before proceeding
      expect(routeId).toBeDefined()
      if (!routeId) {
        throw new Error('Failed to create test delivery route')
      }

      // Update stops count
      const updatedRoute = await updateStops(routeId, 7)
      expect(updatedRoute).toBeDefined()
      expect(updatedRoute?.stops).toBe(7)
    })

    it('should update delivery metrics', async () => {
      // Create a route
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
      }

      const request = new TestRequest(requestData)
      const route = await store(request as any)
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      expect(routeId).toBeDefined()
      if (!routeId) {
        throw new Error('Failed to create test delivery route')
      }

      // Update delivery metrics
      const updatedRoute = await updateMetrics(routeId, 180, 100)
      expect(updatedRoute).toBeDefined()
      expect(updatedRoute?.delivery_time).toBe(180)
      expect(updatedRoute?.total_distance).toBe(100)
    })
  })

  describe('fetch', () => {
    it('should fetch active delivery routes', async () => {
      // Create some routes with different last_active times
      const now = new Date()
      const activeRoutes = [
        new TestRequest({
          driver: 'John Doe',
          vehicle: 'Truck A123',
          stops: 5,
          delivery_time: 120,
          total_distance: 50,
          last_active: now.toISOString(),
        }),
        new TestRequest({
          driver: 'Jane Smith',
          vehicle: 'Van B456',
          stops: 3,
          delivery_time: 60,
          total_distance: 25,
          last_active: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        }),
      ]

      await bulkStore(activeRoutes as any)

      const active = await fetchActive()
      expect(active.length).toBeGreaterThanOrEqual(2)
    })

    it('should fetch routes by driver', async () => {
      // Create routes for the same driver
      const driverName = 'John Doe'
      const routes = [
        new TestRequest({
          driver: driverName,
          vehicle: 'Truck A123',
          stops: 5,
          delivery_time: 120,
          total_distance: 50,
        }),
        new TestRequest({
          driver: driverName,
          vehicle: 'Van B456',
          stops: 3,
          delivery_time: 60,
          total_distance: 25,
        }),
      ]

      await bulkStore(routes as any)

      const driverRoutes = await fetchByDriver(driverName)
      expect(driverRoutes.length).toBeGreaterThanOrEqual(2)
      expect(driverRoutes.every(route => route.driver === driverName)).toBe(true)
    })
  })

  describe('destroy', () => {
    it('should delete a delivery route from the database', async () => {
      // First create a route to delete
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
      }

      // Create the route
      const request = new TestRequest(requestData)
      const route = await store(request as any)
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      // Make sure we have a valid route ID before proceeding
      expect(routeId).toBeDefined()
      if (!routeId) {
        throw new Error('Failed to create test delivery route')
      }

      // Verify the route exists
      let fetchedRoute = await fetchById(routeId)
      expect(fetchedRoute).toBeDefined()

      // Delete the route
      const result = await destroy(routeId)
      expect(result).toBe(true)

      // Verify the route no longer exists
      fetchedRoute = await fetchById(routeId)
      expect(fetchedRoute).toBeUndefined()
    })

    it('should soft delete a delivery route', async () => {
      // Create a route
      const requestData = {
        driver: 'John Doe',
        vehicle: 'Truck A123',
        stops: 5,
        delivery_time: 120,
        total_distance: 50,
        last_active: new Date().toISOString(),
      }

      // Create the route
      const request = new TestRequest(requestData)
      const route = await store(request as any)
      const routeId = route?.id !== undefined ? Number(route.id) : undefined

      expect(routeId).toBeDefined()
      if (!routeId) {
        throw new Error('Failed to create test delivery route')
      }

      // Soft delete the route
      const result = await softDelete(routeId)
      expect(result).toBe(true)

      // Verify the route still exists but has no last_active
      const fetchedRoute = await fetchById(routeId)
      expect(fetchedRoute).toBeDefined()
      expect(fetchedRoute?.last_active).toBeUndefined()
    })

    it('should delete multiple delivery routes from the database', async () => {
      // Create several routes to delete
      const routeIds = []

      // Create 3 test routes
      for (let i = 0; i < 3; i++) {
        const requestData = {
          driver: `Driver ${i}`,
          vehicle: `Vehicle ${i}`,
          stops: 3 + i,
          delivery_time: 60 + i * 30,
          total_distance: 25 + i * 10,
        }

        const request = new TestRequest(requestData)
        const route = await store(request as any)

        const routeId = route?.id !== undefined ? Number(route.id) : undefined
        expect(routeId).toBeDefined()

        if (routeId) {
          routeIds.push(routeId)
        }
      }

      // Ensure we have created the routes
      expect(routeIds.length).toBe(3)

      // Delete the routes
      const deletedCount = await bulkDestroy(routeIds)
      expect(deletedCount).toBe(3)

      // Verify the routes no longer exist
      for (const id of routeIds) {
        const fetchedRoute = await fetchById(id)
        expect(fetchedRoute).toBeUndefined()
      }
    })

    it('should soft delete multiple delivery routes', async () => {
      // Create several routes to soft delete
      const routeIds = []

      // Create 3 test routes
      for (let i = 0; i < 3; i++) {
        const requestData = {
          driver: `Driver ${i}`,
          vehicle: `Vehicle ${i}`,
          stops: 3 + i,
          delivery_time: 60 + i * 30,
          total_distance: 25 + i * 10,
          last_active: new Date().toISOString(),
        }

        const request = new TestRequest(requestData)
        const route = await store(request as any)

        const routeId = route?.id !== undefined ? Number(route.id) : undefined
        expect(routeId).toBeDefined()

        if (routeId) {
          routeIds.push(routeId)
        }
      }

      // Ensure we have created the routes
      expect(routeIds.length).toBe(3)

      // Soft delete the routes
      const deletedCount = await bulkSoftDelete(routeIds)
      expect(deletedCount).toBe(3)

      // Verify the routes still exist but have no last_active
      for (const id of routeIds) {
        const fetchedRoute = await fetchById(id)
        expect(fetchedRoute).toBeDefined()
        expect(fetchedRoute?.last_active).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of routes', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })

    it('should return 0 when trying to soft delete an empty array of routes', async () => {
      // Try to soft delete with an empty array
      const deletedCount = await bulkSoftDelete([])
      expect(deletedCount).toBe(0)
    })
  })
})
