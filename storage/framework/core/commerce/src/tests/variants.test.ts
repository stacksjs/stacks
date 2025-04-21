import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../products/variants/destroy'
import { bulkStore, formatVariantOptions, generateVariantCombinations, store } from '../products/variants/store'
import { bulkUpdate, update, updateStatus } from '../products/variants/update'

// Helper function to fetch a variant by ID (similar to fetchById in gift-cards)
async function fetchVariantById(id: number) {
  const { db } = await import('@stacksjs/database')

  return db
    .selectFrom('product_variants')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Variant Module', () => {
  describe('store', () => {
    it('should create a new product variant in the database', async () => {
      const requestData = {
        product_id: 1,
        variant: 'Color',
        type: 'dropdown',
        description: 'Available colors',
        options: JSON.stringify(['Red', 'Blue', 'Green']),
        status: 'draft',
      }

      const variant = await store(requestData)

      expect(variant).toBeDefined()
      expect(variant?.product_id).toBe(1)
      expect(variant?.variant).toBe('Color')
      expect(variant?.type).toBe('dropdown')
      expect(variant?.description).toBe('Available colors')
      expect(variant?.options).toBe(JSON.stringify(['Red', 'Blue', 'Green']))
      expect(variant?.status).toBe('draft') // Default value

      // Save the ID and convert to number
      const variantId = variant?.id !== undefined ? Number(variant.id) : undefined

      // Verify we can fetch the product variant we just created
      if (variantId) {
        const fetchedVariant = await fetchVariantById(variantId)
        expect(fetchedVariant).toBeDefined()
        expect(fetchedVariant?.id).toBe(variantId)
      }
    })

    it('should create a product variant with default status when not provided', async () => {
      const requestData = {
        product_id: 1,
        variant: 'Size',
        type: 'radio',
        description: 'Available sizes',
        options: JSON.stringify(['S', 'M', 'L', 'XL']),
        status: 'draft',
      }

      const variant = await store(requestData)

      expect(variant).toBeDefined()
      expect(variant?.status).toBe('draft') // Default value
    })

    it('should create a product variant with custom status when provided', async () => {
      const requestData = {
        product_id: 1,
        variant: 'Size',
        type: 'radio',
        description: 'Available sizes',
        options: JSON.stringify(['S', 'M', 'L', 'XL']),
        status: 'active',
      }

      const variant = await store(requestData)

      expect(variant).toBeDefined()
      expect(variant?.status).toBe('active')
    })
  })

  describe('bulkStore', () => {
    it('should create multiple product variants at once', async () => {
      const requestsData = [
        {
          product_id: 1,
          variant: 'Color',
          type: 'dropdown',
          description: 'Available colors',
          options: JSON.stringify(['Red', 'Blue', 'Green']),
          status: 'draft',
        },
        {
          product_id: 1,
          variant: 'Size',
          type: 'radio',
          description: 'Available sizes',
          options: JSON.stringify(['S', 'M', 'L', 'XL']),
          status: 'draft',
        },
      ]

      const createdCount = await bulkStore(requestsData)

      expect(createdCount).toBe(2)
    })

    it('should return 0 when trying to create an empty array of variants', async () => {
      const createdCount = await bulkStore([])
      expect(createdCount).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing product variant', async () => {
      // First create a variant to update
      const initialData = {
        product_id: 1,
        variant: 'Color',
        type: 'dropdown',
        description: 'Available colors',
        options: JSON.stringify(['Red', 'Blue', 'Green']),
        status: 'draft',
      }

      // Create the variant
      const variant = await store(initialData)
      const variantId = variant?.id !== undefined ? Number(variant.id) : undefined

      // Make sure we have a valid variant ID before proceeding
      expect(variantId).toBeDefined()
      if (!variantId) {
        throw new Error('Failed to create test product variant')
      }

      // Update the variant with new data
      const updateData = {
        description: 'Updated color options',
        options: JSON.stringify(['Red', 'Blue', 'Green', 'Yellow']),
        status: 'active',
      }

      const updatedVariant = await update(variantId, updateData)

      // Verify the update was successful
      expect(updatedVariant).toBeDefined()
      expect(updatedVariant?.id).toBe(variantId)
      expect(updatedVariant?.description).toBe('Updated color options')
      expect(updatedVariant?.options).toBe(JSON.stringify(['Red', 'Blue', 'Green', 'Yellow']))
      expect(updatedVariant?.status).toBe('active')

      // The original fields should remain unchanged
      expect(updatedVariant?.product_id).toBe(1)
      expect(updatedVariant?.variant).toBe('Color')
      expect(updatedVariant?.type).toBe('dropdown')
    })
  })

  describe('bulkUpdate', () => {
    it('should update multiple product variants at once', async () => {
      // Create two variants to update
      const variantData1 = {
        product_id: 1,
        variant: 'Color',
        type: 'dropdown',
        description: 'Available colors',
        options: JSON.stringify(['Red', 'Blue', 'Green']),
        status: 'draft',
      }

      const variantData2 = {
        product_id: 1,
        variant: 'Size',
        type: 'radio',
        description: 'Available sizes',
        options: JSON.stringify(['S', 'M', 'L', 'XL']),
        status: 'draft',
      }

      const variant1 = await store(variantData1)
      const variant2 = await store(variantData2)

      const variant1Id = variant1?.id !== undefined ? Number(variant1.id) : undefined
      const variant2Id = variant2?.id !== undefined ? Number(variant2.id) : undefined

      // Ensure both variants were created successfully
      expect(variant1Id).toBeDefined()
      expect(variant2Id).toBeDefined()

      if (!variant1Id || !variant2Id) {
        throw new Error('Failed to create test product variants')
      }

      // Create update data for both variants
      const updateData1 = {
        status: 'active',
        description: 'Updated color description',
      }

      const updateData2 = {
        options: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
        status: 'active',
      }

      // Perform the bulk update
      const updateCount = await bulkUpdate([
        { id: variant1Id, ...updateData1 },
        { id: variant2Id, ...updateData2 },
      ])

      expect(updateCount).toBe(2)

      // Verify the updates
      const updatedVariant1 = await fetchVariantById(variant1Id)
      const updatedVariant2 = await fetchVariantById(variant2Id)

      expect(updatedVariant1).toBeDefined()
      expect(updatedVariant1?.status).toBe('active')
      expect(updatedVariant1?.description).toBe('Updated color description')

      expect(updatedVariant2).toBeDefined()
      expect(updatedVariant2?.options).toBe(JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']))
      expect(updatedVariant2?.status).toBe('active')
    })

    it('should return 0 when trying to update an empty array of variants', async () => {
      const updateCount = await bulkUpdate([])
      expect(updateCount).toBe(0)
    })
  })

  describe('updateStatus', () => {
    it('should update only the status of a product variant', async () => {
      // First create a variant
      const variantData = {
        product_id: 1,
        variant: 'Material',
        type: 'dropdown',
        description: 'Available materials',
        options: JSON.stringify(['Cotton', 'Polyester', 'Wool']),
        status: 'draft',
      }

      const variant = await store(variantData)
      const variantId = variant?.id !== undefined ? Number(variant.id) : undefined

      expect(variantId).toBeDefined()
      if (!variantId) {
        throw new Error('Failed to create test product variant')
      }

      // Update just the status
      const result = await updateStatus(variantId, 'active')
      expect(result).toBe(true)

      // Fetch the updated variant and verify only status changed
      const updatedVariant = await fetchVariantById(variantId)
      expect(updatedVariant).toBeDefined()
      expect(updatedVariant?.status).toBe('active')
      expect(updatedVariant?.description).toBe('Available materials') // Unchanged
      expect(updatedVariant?.options).toBe(JSON.stringify(['Cotton', 'Polyester', 'Wool'])) // Unchanged
    })
  })

  describe('destroy', () => {
    it('should delete a product variant from the database', async () => {
      // First create a variant to delete
      const variantData = {
        product_id: 1,
        variant: 'Color',
        type: 'dropdown',
        description: 'Available colors',
        options: JSON.stringify(['Red', 'Blue', 'Green']),
        status: 'draft',
      }

      // Create the variant
      const variant = await store(variantData)
      const variantId = variant?.id !== undefined ? Number(variant.id) : undefined

      // Make sure we have a valid variant ID before proceeding
      expect(variantId).toBeDefined()
      if (!variantId) {
        throw new Error('Failed to create test product variant')
      }

      // Verify the variant exists
      let fetchedVariant = await fetchVariantById(variantId)
      expect(fetchedVariant).toBeDefined()

      // Delete the variant
      const result = await destroy(variantId)
      expect(result).toBe(true)

      // Verify the variant no longer exists
      fetchedVariant = await fetchVariantById(variantId)
      expect(fetchedVariant).toBeUndefined()
    })
  })

  describe('bulkDestroy', () => {
    it('should delete multiple product variants from the database', async () => {
      // First create multiple variants to delete
      const variants = []
      const variantIds = []

      // Create 3 test variants
      for (let i = 0; i < 3; i++) {
        const variantData = {
          product_id: 1,
          variant: `Variant-${i}`,
          type: 'dropdown',
          description: `Test variant ${i}`,
          options: JSON.stringify([`Option-${i}-1`, `Option-${i}-2`]),
          status: 'draft',
        }

        const variant = await store(variantData)
        expect(variant).toBeDefined()

        const variantId = variant?.id !== undefined ? Number(variant.id) : undefined
        expect(variantId).toBeDefined()

        if (variantId) {
          variantIds.push(variantId)
          variants.push(variant)
        }
      }

      // Ensure we have created the variants
      expect(variantIds.length).toBe(3)

      // Delete the variants
      const deletedCount = await bulkDestroy(variantIds)
      expect(deletedCount).toBe(3)

      // Verify the variants no longer exist
      for (const id of variantIds) {
        const fetchedVariant = await fetchVariantById(id)
        expect(fetchedVariant).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of variants', async () => {
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('formatVariantOptions', () => {
    it('should format an array of options as a JSON string', () => {
      const rawOptions = ['Red', 'Blue', 'Green']
      const formattedOptions = formatVariantOptions(rawOptions)
      expect(formattedOptions).toBe(JSON.stringify(rawOptions))
    })

    it('should trim whitespace from options', () => {
      const rawOptions = [' Red ', 'Blue  ', '  Green']
      const formattedOptions = formatVariantOptions(rawOptions)
      expect(formattedOptions).toBe(JSON.stringify(['Red', 'Blue', 'Green']))
    })

    it('should filter out empty options', () => {
      const rawOptions = ['Red', '', 'Blue', '   ', 'Green']
      const formattedOptions = formatVariantOptions(rawOptions)
      expect(formattedOptions).toBe(JSON.stringify(['Red', 'Blue', 'Green']))
    })

    it('should return an empty array JSON string when given empty input', () => {
      expect(formatVariantOptions([])).toBe('[]')
      expect(formatVariantOptions([] as string[])).toBe('[]')
    })
  })

  describe('generateVariantCombinations', () => {
    it('should generate all possible combinations of variant options', () => {
      const optionSets = {
        size: ['S', 'M', 'L'],
        color: ['Red', 'Blue'],
      }

      const combinations = generateVariantCombinations(optionSets)

      expect(combinations.length).toBe(6) // 3 sizes * 2 colors
      expect(combinations).toContainEqual({ size: 'S', color: 'Red' })
      expect(combinations).toContainEqual({ size: 'S', color: 'Blue' })
      expect(combinations).toContainEqual({ size: 'M', color: 'Red' })
      expect(combinations).toContainEqual({ size: 'M', color: 'Blue' })
      expect(combinations).toContainEqual({ size: 'L', color: 'Red' })
      expect(combinations).toContainEqual({ size: 'L', color: 'Blue' })
    })

    it('should handle three or more option types', () => {
      const optionSets = {
        size: ['S', 'M'],
        color: ['Red', 'Blue'],
        material: ['Cotton', 'Polyester'],
      }

      const combinations = generateVariantCombinations(optionSets)

      expect(combinations.length).toBe(8) // 2 sizes * 2 colors * 2 materials
      expect(combinations).toContainEqual({ size: 'S', color: 'Red', material: 'Cotton' })
      expect(combinations).toContainEqual({ size: 'M', color: 'Blue', material: 'Polyester' })
    })

    it('should return an empty array for empty input', () => {
      const combinations = generateVariantCombinations({})
      expect(combinations).toEqual([])
    })

    it('should handle a single option type correctly', () => {
      const optionSets = {
        size: ['S', 'M', 'L'],
      }

      const combinations = generateVariantCombinations(optionSets)

      expect(combinations.length).toBe(3)
      expect(combinations).toContainEqual({ size: 'S' })
      expect(combinations).toContainEqual({ size: 'M' })
      expect(combinations).toContainEqual({ size: 'L' })
    })
  })
})
