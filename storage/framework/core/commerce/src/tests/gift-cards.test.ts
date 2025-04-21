import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../gift-cards/destroy'
import { fetchByCode, fetchById } from '../gift-cards/fetch'
import { store } from '../gift-cards/store'
import { update, updateBalance } from '../gift-cards/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Gift Card Module', () => {
  describe('store', () => {
    it('should create a new gift card in the database', async () => {
      // Create a unique code to avoid conflicts
      const uniqueCode = `GC-${Date.now()}`

      const requestData = {
        code: uniqueCode,
        initial_balance: 100,
        current_balance: 100,
        status: 'ACTIVE',
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
      }

      const giftCard = await store(requestData)

      expect(giftCard).toBeDefined()
      expect(giftCard?.code).toBe(uniqueCode)
      expect(giftCard?.initial_balance).toBe(100)
      expect(giftCard?.current_balance).toBe(100)
      expect(giftCard?.currency).toBe('USD')
      expect(giftCard?.status).toBe('ACTIVE')

      // Save the ID and convert from Generated<number> to number
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Verify we can fetch the gift card we just created
      if (giftCardId) {
        const fetchedGiftCard = await fetchById(giftCardId)
        expect(fetchedGiftCard).toBeDefined()
        expect(fetchedGiftCard?.id).toBe(giftCardId)
      }
    })

    it('should throw an error when trying to create a gift card with a duplicate code', async () => {
      // Create a unique code to avoid conflicts
      const uniqueCode = `GC-DUPLICATE-${Date.now()}`

      // Create first gift card
      const firstGiftCardData = {
        code: uniqueCode,
        initial_balance: 100,
        current_balance: 100,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
      }

      const firstGiftCard = await store(firstGiftCardData)
      expect(firstGiftCard).toBeDefined()

      // Try to create a second gift card with the same code
      const secondGiftCardData = {
        code: uniqueCode, // Same code as the first gift card
        initial_balance: 50,
        currency: 'USD',
        customer_id: 2,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 50,
      }

      try {
        await store(secondGiftCardData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Check for the specific error message format
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('Failed to create gift card: UNIQUE constraint failed: gift_cards.code'),
        ).toBe(true)
      }
    })

    it('should create a gift card with default values when optional fields are missing', async () => {
      // Create a gift card with only required fields
      const uniqueCode = `GC-DEFAULT-${Date.now()}`

      const minimalRequestData = {
        code: uniqueCode,
        initial_balance: 75,
        currency: 'EUR',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 75,
      }

      const giftCard = await store(minimalRequestData)

      expect(giftCard).toBeDefined()
      expect(giftCard?.code).toBe(uniqueCode)
      expect(giftCard?.initial_balance).toBe(75)
      expect(giftCard?.currency).toBe('EUR')
      expect(giftCard?.status).toBe('ACTIVE') // Default value
      expect(Boolean(giftCard?.is_active)).toBe(true) // Default value
    })
  })

  describe('fetchById and fetchByCode', () => {
    it('should fetch a gift card by ID', async () => {
      // First create a gift card to fetch
      const uniqueCode = `GC-FETCH-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 100,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 100,
      }

      const giftCard = await store(requestData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Now fetch the gift card by ID
      const fetchedGiftCard = await fetchById(giftCardId)

      expect(fetchedGiftCard).toBeDefined()
      expect(fetchedGiftCard?.id).toBe(giftCardId)
      expect(fetchedGiftCard?.code).toBe(uniqueCode)
      expect(fetchedGiftCard?.initial_balance).toBe(100)
    })

    it('should fetch a gift card by code', async () => {
      // Create a gift card with a unique code
      const uniqueCode = `GC-FETCH-CODE-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 150,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 150,
      }

      const giftCard = await store(requestData)
      expect(giftCard).toBeDefined()

      // Now fetch the gift card by code
      const fetchedGiftCard = await fetchByCode(uniqueCode)

      expect(fetchedGiftCard).toBeDefined()
      expect(fetchedGiftCard?.code).toBe(uniqueCode)
      expect(fetchedGiftCard?.initial_balance).toBe(150)
    })
  })

  describe('update', () => {
    it('should update an existing gift card', async () => {
      // First create a gift card to update
      const uniqueCode = `GC-UPDATE-${Date.now()}`
      const initialData = {
        code: uniqueCode,
        initial_balance: 100,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 100,
      }

      // Create the gift card
      const giftCard = await store(initialData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Update the gift card with new data
      const updateData = {
        status: 'USED',
        recipient_name: 'Jane Doe',
        personal_message: 'Happy Birthday!',
      }

      const updatedGiftCard = await update(giftCardId, updateData)

      // Verify the update was successful
      expect(updatedGiftCard).toBeDefined()
      expect(updatedGiftCard?.id).toBe(giftCardId)
      expect(updatedGiftCard?.status).toBe('USED')
      expect(updatedGiftCard?.recipient_name).toBe('Jane Doe')
      expect(updatedGiftCard?.personal_message).toBe('Happy Birthday!')

      // The original fields should remain unchanged
      expect(updatedGiftCard?.code).toBe(uniqueCode)
      expect(updatedGiftCard?.initial_balance).toBe(100)
      expect(updatedGiftCard?.currency).toBe('USD')
    })

    it('should throw an error when trying to update a gift card with an existing code', async () => {
      // Create two gift cards with unique codes
      const code1 = `GC-UPDATE-CONFLICT-1-${Date.now()}`
      const code2 = `GC-UPDATE-CONFLICT-2-${Date.now()}`

      // Create first gift card
      const firstGiftCardData = {
        code: code1,
        initial_balance: 100,
        current_balance: 100,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
      }

      const firstGiftCard = await store(firstGiftCardData)
      const firstGiftCardId = firstGiftCard?.id !== undefined ? Number(firstGiftCard.id) : undefined
      expect(firstGiftCardId).toBeDefined()

      // Create second gift card
      const secondGiftCardData = {
        code: code2,
        initial_balance: 200,
        current_balance: 200,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
      }

      const secondGiftCard = await store(secondGiftCardData)
      const secondGiftCardId = secondGiftCard?.id !== undefined ? Number(secondGiftCard.id) : undefined
      expect(secondGiftCardId).toBeDefined()

      if (!firstGiftCardId || !secondGiftCardId)
        throw new Error('Failed to create test gift cards')

      // Try to update the second gift card with the first gift card's code
      const updateData = {
        code: code1, // This should conflict with the first gift card
      }

      try {
        await update(secondGiftCardId, updateData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Update to use the exact error message format
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('Failed to update gift card: UNIQUE constraint failed: gift_cards.code'),
        ).toBe(true)
      }
    })
  })

  describe('updateBalance', () => {
    it('should update a gift card balance', async () => {
      // Create a gift card with initial balance
      const uniqueCode = `GC-BALANCE-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 100,
        currency: 'USD',
        customer_id: 1,
        status: 'ACTIVE',
        is_active: true,
        is_digital: true,
        current_balance: 100,
      }

      const giftCard = await store(requestData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Update the balance by deducting 25
      const updatedGiftCard = await updateBalance(giftCardId, -25)

      // Verify the update was successful
      expect(updatedGiftCard).toBeDefined()
      expect(updatedGiftCard?.id).toBe(giftCardId)
      expect(updatedGiftCard?.current_balance).toBe(75)
      expect(updatedGiftCard?.status).toBe('ACTIVE')
      expect(updatedGiftCard?.last_used_date).toBeDefined()

      // Deduct the remaining balance
      const fullyUsedGiftCard = await updateBalance(giftCardId, -75)
      expect(fullyUsedGiftCard?.current_balance).toBe(0)
      expect(fullyUsedGiftCard?.status).toBe('USED')
    })

    it('should throw an error when trying to deduct more than available balance', async () => {
      // Create a gift card with initial balance
      const uniqueCode = `GC-INSUFFICIENT-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 50,
        currency: 'USD',
        customer_id: 1,
        status: 'ACTIVE',
        is_active: true,
        is_digital: true,
        current_balance: 50,
      }

      const giftCard = await store(requestData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Try to deduct more than available
      try {
        await updateBalance(giftCardId, -100)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('Insufficient gift card balance')
      }
    })

    it('should throw an error when trying to update an inactive gift card', async () => {
      // Create an inactive gift card
      const uniqueCode = `GC-INACTIVE-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 50,
        currency: 'USD',
        customer_id: 1,
        status: 'DEACTIVATED',
        is_active: false,
        is_digital: true,
        current_balance: 50,
      }

      const giftCard = await store(requestData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Try to update balance of inactive gift card
      try {
        await updateBalance(giftCardId, -10)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('Gift card is not active')
      }
    })
  })

  describe('remove', () => {
    it('should delete a gift card from the database', async () => {
      // First create a gift card to delete
      const uniqueCode = `GC-DELETE-${Date.now()}`
      const requestData = {
        code: uniqueCode,
        initial_balance: 100,
        currency: 'USD',
        customer_id: 1,
        is_digital: true,
        is_active: true,
        status: 'ACTIVE',
        current_balance: 100,
      }

      // Create the gift card
      const giftCard = await store(requestData)
      const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined

      // Make sure we have a valid gift card ID before proceeding
      expect(giftCardId).toBeDefined()
      if (!giftCardId) {
        throw new Error('Failed to create test gift card')
      }

      // Verify the gift card exists
      let fetchedGiftCard = await fetchById(giftCardId)
      expect(fetchedGiftCard).toBeDefined()

      // Delete the gift card
      const result = await destroy(giftCardId)
      expect(result).toBe(true)

      // Verify the gift card no longer exists
      fetchedGiftCard = await fetchById(giftCardId)
      expect(fetchedGiftCard).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent gift card', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to delete and expect an error
      try {
        await destroy(nonExistentId)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Gift card with ID ${nonExistentId} not found`)
      }
    })
  })

  describe('bulkRemove', () => {
    it('should delete multiple gift cards from the database', async () => {
      // First create multiple gift cards to delete
      const giftCards = []
      const giftCardIds = []

      // Create 3 test gift cards
      for (let i = 0; i < 3; i++) {
        const uniqueCode = `GC-BULK-DELETE-${i}-${Date.now()}`
        const requestData = {
          code: uniqueCode,
          initial_balance: 50 + (i * 10),
          currency: 'USD',
          customer_id: 1,
          is_digital: true,
          is_active: true,
          status: 'ACTIVE',
          current_balance: 50 + (i * 10),
        }

        const giftCard = await store(requestData)
        expect(giftCard).toBeDefined()

        const giftCardId = giftCard?.id !== undefined ? Number(giftCard.id) : undefined
        expect(giftCardId).toBeDefined()

        if (giftCardId) {
          giftCardIds.push(giftCardId)
          giftCards.push(giftCard)
        }
      }

      // Ensure we have created the gift cards
      expect(giftCardIds.length).toBe(3)

      // Delete the gift cards
      const deletedCount = await bulkDestroy(giftCardIds)
      expect(deletedCount).toBe(3)

      // Verify the gift cards no longer exist
      for (const id of giftCardIds) {
        const fetchedGiftCard = await fetchById(id)
        expect(fetchedGiftCard).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of gift cards', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
