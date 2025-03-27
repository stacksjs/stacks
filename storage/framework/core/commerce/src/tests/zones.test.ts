import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../zones/destroy'
import { fetchById } from '../zones/fetch'
import { bulkStore, store } from '../zones/store'
import { formatZoneOptions, getActiveShippingZones, getZonesByCountry } from '../zones/fetch'
import { update, updateCountries, updateRegionsAndPostalCodes, updateStatus } from '../zones/update'

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
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('Shipping Zone Module', () => {
  describe('store', () => {
    it('should create a new shipping zone in the database', async () => {
      const requestData = {
        name: 'US Zone',
        countries: JSON.stringify(['US']),
        regions: JSON.stringify(['California', 'New York']),
        postal_codes: JSON.stringify(['90210', '10001']),
        status: 'active',
        shipping_method_id: 1,
      }

      const request = new TestRequest(requestData)
      const zone = await store(request as any)

      expect(zone).toBeDefined()
      expect(zone?.name).toBe('US Zone')
      expect(zone?.countries).toBe(JSON.stringify(['US']))
      expect(zone?.regions).toBe(JSON.stringify(['California', 'New York']))
      expect(zone?.postal_codes).toBe(JSON.stringify(['90210', '10001']))
      expect(zone?.status).toBe('active')
      expect(zone?.shipping_method_id).toBe(1)
      expect(zone?.uuid).toBeDefined()

      // Save the ID for further testing
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Verify we can fetch the zone we just created
      if (zoneId) {
        const fetchedZone = await fetchById(zoneId)
        expect(fetchedZone).toBeDefined()
        expect(fetchedZone?.id).toBe(zoneId)
      }
    })

    it('should create a zone with minimal required fields', async () => {
      // Create a zone with only required fields
      const minimalRequestData = {
        name: 'Minimal Zone',
        countries: JSON.stringify(['CA']),
        shipping_method_id: 2,
        status: 'active',
      }

      const request = new TestRequest(minimalRequestData)
      const zone = await store(request as any)

      expect(zone).toBeDefined()
      expect(zone?.name).toBe('Minimal Zone')
      expect(zone?.countries).toBe(JSON.stringify(['CA']))
      expect(zone?.shipping_method_id).toBe(2)
      expect(zone?.uuid).toBeDefined()
    })

    it('should create multiple shipping zones with bulk store', async () => {
      const requests = [
        new TestRequest({
          name: 'Zone 1',
          countries: JSON.stringify(['US']),
          shipping_method_id: 1,
          status: 'active',
        }),
        new TestRequest({
          name: 'Zone 2',
          countries: JSON.stringify(['CA']),
          shipping_method_id: 1,
          status: 'active',
        }),
        new TestRequest({
          name: 'Zone 3',
          countries: JSON.stringify(['MX']),
          shipping_method_id: 1,
          status: 'active',
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify zones can be found by country
      const usZones = await getZonesByCountry('US')
      expect(usZones.length).toBeGreaterThan(0)
      expect(usZones[0].name).toBe('Zone 1')

      const caZones = await getZonesByCountry('CA')
      expect(caZones.length).toBeGreaterThan(0)
      expect(caZones[0].name).toBe('Zone 2')
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })

    it('should format zone options for dropdowns', async () => {
      // First create some zones
      await store(new TestRequest({
        name: 'Zone A',
        countries: JSON.stringify(['US']),
        status: 'active',
        shipping_method_id: 1,
      }) as any)

      await store(new TestRequest({
        name: 'Zone B',
        countries: JSON.stringify(['CA']),
        status: 'inactive',
        shipping_method_id: 1,
      }) as any)

      // Now get formatted options
      const options = await formatZoneOptions()

      expect(options).toBeDefined()
      expect(options.length).toBe(2)

      // Verify structure of options
      expect(options[0].id).toBeDefined()
      expect(options[0].name).toBeDefined()
      expect(options[0].status).toBeDefined()
      expect(options[0].countries).toBeDefined()

      // Verify names are present
      const names = options.map(opt => opt.name)
      expect(names).toContain('Zone A')
      expect(names).toContain('Zone B')
    })

    it('should get active shipping zones', async () => {
      // Create active zone
      await store(new TestRequest({
        name: 'Active Zone',
        countries: JSON.stringify(['US']),
        status: 'active',
        shipping_method_id: 1,
      }) as any)

      // Create inactive zone
      await store(new TestRequest({
        name: 'Inactive Zone',
        countries: JSON.stringify(['CA']),
        status: 'inactive',
        shipping_method_id: 1,
      }) as any)

      // Get active zones
      const activeZones = await getActiveShippingZones()

      expect(activeZones).toBeDefined()
      expect(activeZones.length).toBe(1)
      expect(activeZones[0].name).toBe('Active Zone')
      expect(activeZones[0].status).toBe('active')
    })
  })

  describe('update', () => {
    it('should update an existing shipping zone', async () => {
      // First create a zone to update
      const requestData = {
        name: 'Original Zone',
        countries: JSON.stringify(['US']),
        regions: JSON.stringify(['California']),
        status: 'active',
        shipping_method_id: 1,
      }

      // Create the zone
      const createRequest = new TestRequest(requestData)
      const zone = await store(createRequest as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Make sure we have a valid zone ID before proceeding
      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      const updateData = {
        name: 'Updated Zone',
        countries: JSON.stringify(['US', 'CA']),
        regions: JSON.stringify(['California', 'Oregon']),
        status: 'inactive',
      }

      const updateRequest = new TestRequest(updateData)
      const updatedZone = await update(zoneId, updateRequest as any)

      // Verify the update was successful
      expect(updatedZone).toBeDefined()
      expect(updatedZone?.id).toBe(zoneId)
      expect(updatedZone?.name).toBe('Updated Zone')
      expect(updatedZone?.countries).toBe(JSON.stringify(['US', 'CA']))
      expect(updatedZone?.regions).toBe(JSON.stringify(['California', 'Oregon']))
      expect(updatedZone?.status).toBe('inactive')

      // The original fields should remain unchanged
      expect(updatedZone?.shipping_method_id).toBe(1)
    })

    it('should update a shipping zone\'s status', async () => {
      // Create a zone
      const requestData = {
        name: 'Status Test Zone',
        countries: JSON.stringify(['US']),
        status: 'active',
        shipping_method_id: 1,
      }

      const request = new TestRequest(requestData)
      const zone = await store(request as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Make sure we have a valid zone ID before proceeding
      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      // Update status to inactive
      const updatedZone = await updateStatus(zoneId, 'inactive')
      expect(updatedZone).toBeDefined()
      expect(updatedZone?.status).toBe('inactive')

      // Update status back to active
      const reactivatedZone = await updateStatus(zoneId, 'active')
      expect(reactivatedZone).toBeDefined()
      expect(reactivatedZone?.status).toBe('active')
    })

    it('should update a shipping zone\'s countries', async () => {
      // Create a zone
      const requestData = {
        name: 'Countries Test Zone',
        countries: JSON.stringify(['US']),
        shipping_method_id: 1,
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const zone = await store(request as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Make sure we have a valid zone ID before proceeding
      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      // Update countries
      const updatedCountries = JSON.stringify(['US', 'CA', 'MX'])
      const updatedZone = await updateCountries(zoneId, updatedCountries)

      expect(updatedZone).toBeDefined()
      expect(updatedZone?.countries).toBe(updatedCountries)
    })

    it('should update a shipping zone\'s regions and postal codes', async () => {
      // Create a zone
      const requestData = {
        name: 'Regions Test Zone',
        countries: JSON.stringify(['US']),
        regions: JSON.stringify(['California']),
        postal_codes: JSON.stringify(['90210']),
        shipping_method_id: 1,
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const zone = await store(request as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Make sure we have a valid zone ID before proceeding
      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      // Update regions and postal codes
      const updatedRegions = JSON.stringify(['California', 'New York', 'Texas'])
      const updatedPostalCodes = JSON.stringify(['90210', '10001', '77001'])

      const updatedZone = await updateRegionsAndPostalCodes(zoneId, updatedRegions, updatedPostalCodes)

      expect(updatedZone).toBeDefined()
      expect(updatedZone?.regions).toBe(updatedRegions)
      expect(updatedZone?.postal_codes).toBe(updatedPostalCodes)
    })

    it('should update only postal codes when regions are not provided', async () => {
      // Create a zone
      const requestData = {
        name: 'Partial Update Zone',
        countries: JSON.stringify(['US']),
        regions: JSON.stringify(['California']),
        postal_codes: JSON.stringify(['90210']),
        shipping_method_id: 1,
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const zone = await store(request as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      // Update only postal codes
      const updatedPostalCodes = JSON.stringify(['90210', '10001', '77001'])
      const updatedZone = await updateRegionsAndPostalCodes(zoneId, undefined, updatedPostalCodes)

      expect(updatedZone).toBeDefined()
      expect(updatedZone?.regions).toBe(JSON.stringify(['California'])) // Should remain unchanged
      expect(updatedZone?.postal_codes).toBe(updatedPostalCodes)
    })
  })

  describe('destroy', () => {
    it('should delete a shipping zone from the database', async () => {
      // First create a zone to delete
      const requestData = {
        name: 'Zone to Delete',
        countries: JSON.stringify(['US']),
        shipping_method_id: 1,
        status: 'active',
      }

      // Create the zone
      const request = new TestRequest(requestData)
      const zone = await store(request as any)
      const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined

      // Make sure we have a valid zone ID before proceeding
      expect(zoneId).toBeDefined()
      if (!zoneId) {
        throw new Error('Failed to create test shipping zone')
      }

      // Verify the zone exists
      let fetchedZone = await fetchById(zoneId)
      expect(fetchedZone).toBeDefined()

      // Delete the zone
      const result = await destroy(zoneId)
      expect(result).toBe(true)

      // Verify the zone no longer exists
      fetchedZone = await fetchById(zoneId)
      expect(fetchedZone).toBeUndefined()
    })

    it('should delete multiple shipping zones from the database', async () => {
      // Create several zones to delete
      const zoneIds = []

      // Create 3 test zones
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Bulk Delete Zone ${i}`,
          countries: JSON.stringify(['US']),
          shipping_method_id: 1,
          status: 'active',
        }

        const request = new TestRequest(requestData)
        const zone = await store(request as any)

        const zoneId = zone?.id !== undefined ? Number(zone.id) : undefined
        expect(zoneId).toBeDefined()

        if (zoneId) {
          zoneIds.push(zoneId)
        }
      }

      // Ensure we have created the zones
      expect(zoneIds.length).toBe(3)

      // Delete the zones
      const deletedCount = await bulkDestroy(zoneIds)
      expect(deletedCount).toBe(3)

      // Verify the zones no longer exist
      for (const id of zoneIds) {
        const fetchedZone = await fetchById(id)
        expect(fetchedZone).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of zones', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
