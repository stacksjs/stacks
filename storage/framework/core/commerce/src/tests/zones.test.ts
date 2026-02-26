import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { formatZoneOptions, getActiveShippingZones } from '../shippings/shipping-zones/fetch'
import { bulkStore, store } from '../shippings/shipping-zones/store'
import { bulkDestroy } from '../shippings/shipping-zones/destroy'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Shipping Zone Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })

    it('should format zone options for dropdowns', async () => {
      // First create some zones
      await store({
        name: 'Zone A',
        countries: JSON.stringify(['US']),
        status: 'active',
        shipping_method_id: 1,
      })

      await store({
        name: 'Zone B',
        countries: JSON.stringify(['CA']),
        status: 'inactive',
        shipping_method_id: 1,
      })

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
      await store({
        name: 'Active Zone',
        countries: JSON.stringify(['US']),
        status: 'active',
        shipping_method_id: 1,
      })

      // Create inactive zone
      await store({
        name: 'Inactive Zone',
        countries: JSON.stringify(['CA']),
        status: 'inactive',
        shipping_method_id: 1,
      })

      // Get active zones
      const activeZones = await getActiveShippingZones()

      expect(activeZones).toBeDefined()
      expect(activeZones.length).toBe(1)
      expect(activeZones[0].name).toBe('Active Zone')
      expect(activeZones[0].status).toBe('active')
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of zones', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
