import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy } from '../products/units/destroy'
import { fetchAll } from '../products/units/fetch'
import { bulkStore, formatUnitOptions } from '../products/units/store'
import { bulkUpdate, updateDefaultStatus } from '../products/units/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Unit Module', () => {
  describe('bulkStore', () => {
    it('should create multiple product units at once', async () => {
      const unitRequests = [
        {
          name: 'Kilogram',
          product_id: 1,
          abbreviation: 'kg',
          type: 'weight',
          description: 'Standard weight unit',
          is_default: true,
        },
        {
          name: 'Liter',
          product_id: 1,
          abbreviation: 'L',
          type: 'volume',
          description: 'Standard volume unit',
          is_default: true,
        },
        {
          name: 'Piece',
          product_id: 1,
          abbreviation: 'pc',
          type: 'quantity',
          description: 'Standard quantity unit',
          is_default: true,
        },
      ]

      const createdCount = await bulkStore(unitRequests)
      expect(createdCount).toBe(3)
    })

    it('should return 0 when trying to create an empty array of units', async () => {
      const createdCount = await bulkStore([])
      expect(createdCount).toBe(0)
    })

  })

  describe('formatUnitOptions and getDefaultUnit', () => {
    it('should format unit options correctly', async () => {
      // Create units first
      const unitRequests = [
        {
          name: 'Kilogram',
          product_id: 1,
          abbreviation: 'kg',
          type: 'weight',
          is_default: true,
        },
        {
          name: 'Gram',
          product_id: 1,
          abbreviation: 'g',
          type: 'weight',
          is_default: false,
        },
        {
          name: 'Liter',
          product_id: 1,
          abbreviation: 'L',
          type: 'volume',
          is_default: true,
        },
      ]

      await bulkStore(unitRequests)

      // Test formatting options for weight units
      const weightUnits = await formatUnitOptions('weight')
      expect(weightUnits.length).toBe(2)
      expect(weightUnits[0].name).toBe('Gram') // Alphabetical order
      expect(weightUnits[1].name).toBe('Kilogram')
      expect(weightUnits[0].abbreviation).toBe('g')
      expect(weightUnits[1].abbreviation).toBe('kg')
      expect(Boolean(weightUnits[0].is_default)).toBe(false)
      expect(Boolean(weightUnits[1].is_default)).toBe(true)

      // Test formatting options for all units (no type filter)
      const allUnits = await formatUnitOptions()
      expect(allUnits.length).toBe(3)
    })
  })

  describe('bulkUpdate', () => {
    it('should return 0 when trying to update an empty array of units', async () => {
      const updatedCount = await bulkUpdate([])
      expect(updatedCount).toBe(0)
    })
  })

  describe('updateDefaultStatus', () => {
    it('atomically selects one default unit for a type', async () => {
      await bulkStore([
        {
          name: 'Kilogram',
          abbreviation: 'kg',
          type: 'weight',
          is_default: true,
        },
        {
          name: 'Gram',
          abbreviation: 'g',
          type: 'weight',
          is_default: false,
        },
      ])
      const units = await fetchAll()
      const gram = units.find(unit => unit.name === 'Gram')

      expect(gram).toBeDefined()
      expect(await updateDefaultStatus(Number(gram!.id), true)).toBe(true)

      const updated = await fetchAll()
      expect(Boolean(updated.find(unit => unit.name === 'Gram')?.is_default)).toBe(true)
      expect(Boolean(updated.find(unit => unit.name === 'Kilogram')?.is_default)).toBe(false)
    })

    it('returns false when the unit does not exist', async () => {
      expect(await updateDefaultStatus(999, true)).toBe(false)
    })
  })

  describe('bulkDestroy', () => {
    it('should return 0 when trying to delete an empty array of units', async () => {
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
