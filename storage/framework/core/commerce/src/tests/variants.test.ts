import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../products/variants/destroy'
import { bulkStore, formatVariantOptions, generateVariantCombinations } from '../products/variants/store'
import { bulkUpdate } from '../products/variants/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Variant Module', () => {
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

  describe('bulkUpdate', () => {
    it('should return 0 when trying to update an empty array of variants', async () => {
      const updateCount = await bulkUpdate([])
      expect(updateCount).toBe(0)
    })
  })

  describe('bulkDestroy', () => {
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
