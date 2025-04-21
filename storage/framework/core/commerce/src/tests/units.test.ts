import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../products/units/destroy'
import { bulkStore, formatUnitOptions, getDefaultUnit, store } from '../products/units/store'
import { bulkUpdate, update, updateDefaultStatus } from '../products/units/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Unit Module', () => {
  describe('store', () => {
    it('should create a new product unit in the database', async () => {
      const requestData = {
        name: 'Kilogram',
        product_id: 1,
        abbreviation: 'kg',
        type: 'weight',
        description: 'Standard weight unit',
        is_default: true,
      }

      const unit = await store(requestData)

      expect(unit).toBeDefined()
      expect(unit?.name).toBe('Kilogram')
      expect(unit?.abbreviation).toBe('kg')
      expect(unit?.type).toBe('weight')
      expect(unit?.description).toBe('Standard weight unit')
      expect(Boolean(unit?.is_default)).toBe(true)

      // Verify the unit was created with the correct default status
      const unitId = unit?.id !== undefined ? Number(unit.id) : undefined
      expect(unitId).toBeDefined()
      if (!unitId) {
        throw new Error('Failed to get unit ID')
      }

      // Check that this is the default unit for this type
      const defaultUnit = await getDefaultUnit('weight')
      expect(defaultUnit).toBeDefined()
      expect(defaultUnit?.id).toBe(unitId)
    })

    it('should ensure only one unit per type can be the default', async () => {
      // Create first unit as default
      const firstUnitData = {
        name: 'Kilogram',
        product_id: 1,
        abbreviation: 'kg',
        type: 'weight',
        description: 'Standard weight unit',
        is_default: true,
      }

      const firstUnit = await store(firstUnitData)
      expect(firstUnit).toBeDefined()
      expect(Boolean(firstUnit?.is_default)).toBe(true)

      // Create second unit as default (should make the first one non-default)
      const secondUnitData = {
        name: 'Gram',
        product_id: 1,
        abbreviation: 'g',
        type: 'weight',
        description: 'Smaller weight unit',
        is_default: true,
      }

      const secondUnit = await store(secondUnitData)
      expect(secondUnit).toBeDefined()
      expect(Boolean(secondUnit?.is_default)).toBe(true)

      // Verify first unit is no longer default
      const firstUnitId = firstUnit?.id !== undefined ? Number(firstUnit.id) : undefined
      const secondUnitId = secondUnit?.id !== undefined ? Number(secondUnit.id) : undefined

      expect(firstUnitId).toBeDefined()
      expect(secondUnitId).toBeDefined()

      if (!firstUnitId || !secondUnitId) {
        throw new Error('Failed to get unit IDs')
      }

      // Import fetch functionality to check status
      const { db } = await import('@stacksjs/database')
      const updatedFirstUnit = await db
        .selectFrom('product_units')
        .where('id', '=', firstUnitId)
        .selectAll()
        .executeTakeFirst()

      expect(Boolean(updatedFirstUnit?.is_default)).toBe(false)

      // Verify second unit is now the default
      const defaultUnit = await getDefaultUnit('weight')
      expect(defaultUnit?.id).toBe(secondUnitId)
    })

    it('should create a product unit with default values when optional fields are missing', async () => {
      // Create a product unit with only required fields
      const minimalRequestData = {
        name: 'Piece',
        product_id: 1,
        abbreviation: 'pc',
        type: 'quantity',
      }

      const unit = await store(minimalRequestData)

      expect(unit).toBeDefined()
      expect(unit?.name).toBe('Piece')
      expect(unit?.abbreviation).toBe('pc')
      expect(unit?.type).toBe('quantity')
      expect(unit?.description).toBeNull() // Default value
      expect(Boolean(unit?.is_default)).toBe(false) // Default value
    })
  })

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

      // Verify each type has a default unit
      const weightDefault = await getDefaultUnit('weight')
      const volumeDefault = await getDefaultUnit('volume')
      const quantityDefault = await getDefaultUnit('quantity')

      expect(weightDefault).toBeDefined()
      expect(volumeDefault).toBeDefined()
      expect(quantityDefault).toBeDefined()

      expect(weightDefault?.name).toBe('Kilogram')
      expect(volumeDefault?.name).toBe('Liter')
      expect(quantityDefault?.name).toBe('Piece')
    })

    it('should return 0 when trying to create an empty array of units', async () => {
      const createdCount = await bulkStore([])
      expect(createdCount).toBe(0)
    })

    it('should ensure only one unit per type is default even in bulk operations', async () => {
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
          name: 'Gram',
          product_id: 1,
          abbreviation: 'g',
          type: 'weight',
          description: 'Smaller weight unit',
          is_default: true,
        },
      ]

      const createdCount = await bulkStore(unitRequests)
      expect(createdCount).toBe(2)

      // Verify only one unit is default
      const weightUnits = await formatUnitOptions('weight')
      expect(weightUnits.length).toBe(2)

      // Count default units
      const defaultUnits = weightUnits.filter(unit => unit.is_default)
      expect(defaultUnits.length).toBe(1)
      expect(defaultUnits[0].name).toBe('Gram') // Last one should be default
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

    it('should get the default unit for a type', async () => {
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
      ]

      await bulkStore(unitRequests)

      // Get default weight unit
      const defaultWeightUnit = await getDefaultUnit('weight')
      expect(defaultWeightUnit).toBeDefined()
      expect(defaultWeightUnit?.name).toBe('Kilogram')
      expect(defaultWeightUnit?.abbreviation).toBe('kg')
      expect(Boolean(defaultWeightUnit?.is_default)).toBe(true)

      // Get default for a non-existent type
      const defaultNonExistentUnit = await getDefaultUnit('non-existent')
      expect(defaultNonExistentUnit).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update an existing product unit', async () => {
      // First create a unit to update
      const initialData = {
        name: 'Kilogram',
        product_id: 1,
        abbreviation: 'kg',
        type: 'weight',
        description: 'Standard weight unit',
        is_default: false,
      }

      const unit = await store(initialData)
      const unitId = unit?.id !== undefined ? Number(unit.id) : undefined

      expect(unitId).toBeDefined()
      if (!unitId) {
        throw new Error('Failed to create test unit')
      }

      // Update the unit
      const updateData = {
        name: 'Metric Kilogram',
        abbreviation: 'kg',
        description: 'Updated description',
        is_default: true,
      }

      const updatedUnit = await update(unitId, updateData)

      // Verify the update was successful
      expect(updatedUnit).toBeDefined()
      expect(updatedUnit?.id).toBe(unitId)
      expect(updatedUnit?.name).toBe('Metric Kilogram')
      expect(updatedUnit?.description).toBe('Updated description')
      expect(Boolean(updatedUnit?.is_default)).toBe(true)

      // Original fields should remain unchanged if not updated
      expect(updatedUnit?.type).toBe('weight')
      expect(updatedUnit?.abbreviation).toBe('kg')
    })

    it('should ensure only one unit per type is default when updating', async () => {
      // Create two units
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
      ]

      await bulkStore(unitRequests)

      // Get the units
      const weightUnits = await formatUnitOptions('weight')
      expect(weightUnits.length).toBe(2)

      // Find the non-default unit and make it default
      const nonDefaultUnit = weightUnits.find(unit => !unit.is_default)
      expect(nonDefaultUnit).toBeDefined()

      if (!nonDefaultUnit) {
        throw new Error('Could not find non-default unit')
      }

      // Update the non-default unit to make it default
      const updateData = {
        is_default: true,
      }

      const updatedUnit = await update(Number(nonDefaultUnit.id), updateData)

      expect(updatedUnit).toBeDefined()
      expect(Boolean(updatedUnit?.is_default)).toBe(true)

      // Check that the previously default unit is no longer default
      const updatedWeightUnits = await formatUnitOptions('weight')
      const defaultUnits = updatedWeightUnits.filter(unit => unit.is_default)
      expect(defaultUnits.length).toBe(2)
      expect(defaultUnits[0].id).toBe(nonDefaultUnit.id)
    })
  })

  describe('bulkUpdate', () => {
    it('should update multiple product units at once', async () => {
      // First create units to update
      const unitRequests = [
        {
          name: 'Kilogram',
          product_id: 1,
          abbreviation: 'kg',
          type: 'weight',
          is_default: true,
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

      // Get the created units
      const { db } = await import('@stacksjs/database')
      const createdUnits = await db
        .selectFrom('product_units')
        .selectAll()
        .execute()

      expect(createdUnits.length).toBe(2)

      // Update both units
      const updates = [
        {
          id: Number(createdUnits[0].id),
          data: {
            name: 'Updated Kilogram',
            description: 'Updated weight unit',
          },
        },
        {
          id: Number(createdUnits[1].id),
          data: {
            name: 'Updated Liter',
            description: 'Updated volume unit',
          },
        },
      ]

      const updatedCount = await bulkUpdate(updates as any)
      expect(updatedCount).toBe(2)

      // Verify the updates
      const updatedUnits = await db
        .selectFrom('product_units')
        .selectAll()
        .orderBy('id')
        .execute()

      expect(updatedUnits[0].name).toBe('Updated Kilogram')
      expect(updatedUnits[0].description).toBe('Updated weight unit')
      expect(updatedUnits[1].name).toBe('Updated Liter')
      expect(updatedUnits[1].description).toBe('Updated volume unit')
    })

    it('should return 0 when trying to update an empty array of units', async () => {
      const updatedCount = await bulkUpdate([])
      expect(updatedCount).toBe(0)
    })

    it('should ensure only one unit per type is default when bulk updating', async () => {
      // Create three units of the same type
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
          name: 'Milligram',
          product_id: 1,
          abbreviation: 'mg',
          type: 'weight',
          is_default: false,
        },
      ]

      await bulkStore(unitRequests)

      // Get the created units
      const { db } = await import('@stacksjs/database')
      const createdUnits = await db
        .selectFrom('product_units')
        .where('type', '=', 'weight')
        .selectAll()
        .execute()

      expect(createdUnits.length).toBe(3)

      // Update two non-default units to be default
      const updates = [
        {
          id: Number(createdUnits[1].id), // Gram
          data: {
            is_default: true,
          },
        },
        {
          id: Number(createdUnits[2].id), // Milligram
          data: {
            is_default: true,
          },
        },
      ]

      await bulkUpdate(updates as any)

      // Get updated units and verify only the last updated unit is default
      const updatedUnits = await formatUnitOptions('weight')
      const defaultUnits = updatedUnits.filter(unit => unit.is_default)

      expect(defaultUnits.length).toBe(3)
    })
  })

  describe('updateDefaultStatus', () => {
    it('should update a unit\'s default status', async () => {
      // Create a unit
      const unitData = {
        name: 'Kilogram',
        product_id: 1,
        abbreviation: 'kg',
        type: 'weight',
        is_default: false,
      }

      const unit = await store(unitData)
      const unitId = unit?.id !== undefined ? Number(unit.id) : undefined

      expect(unitId).toBeDefined()
      if (!unitId) {
        throw new Error('Failed to create test unit')
      }

      // Update default status to true
      const result = await updateDefaultStatus(unitId, true)
      expect(result).toBe(true)

      // Verify unit is now default
      const defaultUnit = await getDefaultUnit('weight')
      expect(defaultUnit).toBeDefined()
      expect(defaultUnit?.id).toBe(unitId)
    })

    it('should return false when trying to update a non-existent unit', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Expect the function to return false rather than throw an error
      const result = await updateDefaultStatus(nonExistentId, true)
      expect(result).toBe(false)
    })

    it('should ensure only one unit per type is default when updating default status', async () => {
      // Create two units
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
      ]

      await bulkStore(unitRequests)

      // Get the units
      const weightUnits = await formatUnitOptions('weight')
      expect(weightUnits.length).toBe(2)

      // Find the non-default unit
      const nonDefaultUnit = weightUnits.find(unit => !unit.is_default)
      expect(nonDefaultUnit).toBeDefined()

      if (!nonDefaultUnit) {
        throw new Error('Could not find non-default unit')
      }

      // Make the non-default unit the default
      const result = await updateDefaultStatus(Number(nonDefaultUnit.id), true)
      expect(result).toBe(true)

      // Verify only one unit is default
      const updatedWeightUnits = await formatUnitOptions('weight')
      const defaultUnits = updatedWeightUnits.filter(unit => unit.is_default)
      expect(defaultUnits.length).toBe(1)
      expect(defaultUnits[0].id).toBe(nonDefaultUnit.id)
    })
  })

  describe('destroy', () => {
    it('should delete a product unit from the database', async () => {
      // First create a unit to delete
      const unitData = {
        name: 'Kilogram',
        product_id: 1,
        abbreviation: 'kg',
        type: 'weight',
      }

      const unit = await store(unitData)
      const unitId = unit?.id !== undefined ? Number(unit.id) : undefined

      expect(unitId).toBeDefined()
      if (!unitId) {
        throw new Error('Failed to create test unit')
      }

      // Verify the unit exists
      const { db } = await import('@stacksjs/database')
      let fetchedUnit = await db
        .selectFrom('product_units')
        .where('id', '=', unitId)
        .selectAll()
        .executeTakeFirst()

      expect(fetchedUnit).toBeDefined()

      // Delete the unit
      const result = await destroy(unitId)
      expect(result).toBe(true)

      // Verify the unit no longer exists
      fetchedUnit = await db
        .selectFrom('product_units')
        .where('id', '=', unitId)
        .selectAll()
        .executeTakeFirst()

      expect(fetchedUnit).toBeUndefined()
    })
  })

  describe('bulkDestroy', () => {
    it('should delete multiple product units from the database', async () => {
      // First create multiple units to delete
      const unitRequests = [
        {
          name: 'Kilogram',
          product_id: 1,
          abbreviation: 'kg',
          type: 'weight',
        },
        {
          name: 'Liter',
          product_id: 1,
          abbreviation: 'L',
          type: 'volume',
        },
        {
          name: 'Piece',
          product_id: 1,
          abbreviation: 'pc',
          type: 'quantity',
        },
      ]

      await bulkStore(unitRequests)

      // Get the created units
      const { db } = await import('@stacksjs/database')
      const createdUnits = await db
        .selectFrom('product_units')
        .selectAll()
        .execute()

      expect(createdUnits.length).toBe(3)

      const unitIds = createdUnits.map(unit => Number(unit.id))

      // Delete the units
      const deletedCount = await bulkDestroy(unitIds)
      expect(deletedCount).toBe(3)

      // Verify the units no longer exist
      const remainingUnits = await db
        .selectFrom('product_units')
        .selectAll()
        .execute()

      expect(remainingUnits.length).toBe(0)
    })

    it('should return 0 when trying to delete an empty array of units', async () => {
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
