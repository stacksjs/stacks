import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../shippings/delivery-routes/destroy'
import { fetchByDriver, fetchById } from '../shippings/delivery-routes/fetch'
import { store } from '../shippings/delivery-routes/store'
import { update, updateMetrics, updateStops } from '../shippings/delivery-routes/update'

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
        last_active: formatDate(new Date()),
      }

      const route = await store(requestData)

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

      const route = await store(minimalRequestData)

      expect(route).toBeDefined()
      expect(route?.driver).toBe('Jane Smith')
      expect(route?.vehicle).toBe('Van B456')
      expect(route?.stops).toBe(3)
      expect(route?.delivery_time).toBe(60)
      expect(route?.total_distance).toBe(25)
      expect(route?.last_active).toBeNull()
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
      const route = await store(requestData)
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

      const updatedRoute = await update(routeId, updateData)

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

      const route = await store(requestData)
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

      const route = await store(requestData)
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
      const route = await store(requestData)
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

        const route = await store(requestData)

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

    it('should return 0 when trying to delete an empty array of routes', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
