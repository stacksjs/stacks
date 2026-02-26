import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../products/reviews/destroy'
import { fetchApprovedByProductId, fetchByProductId, fetchByUserId, fetchMostHelpfulByProductId } from '../products/reviews/fetch'
import { store } from '../products/reviews/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Review Module', () => {
  describe('fetch methods', () => {
    it('should fetch reviews by product ID', async () => {
      // Create several reviews for the same product
      const productId = 2

      // Create first review
      const request1 = {
        product_id: productId,
        customer_id: 1,
        rating: 5,
        title: 'First review',
        content: 'First review content',
        is_approved: true,
      }

      await store(request1)

      // Create second review
      const request2 = {
        product_id: productId,
        customer_id: 2,
        rating: 4,
        title: 'Second review',
        content: 'Second review content',
        is_approved: true,
      }

      await store(request2)

      // Now fetch reviews by product ID
      const result = await fetchByProductId(productId)

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      expect(result[0].product_id).toBe(productId)
      expect(result[1].product_id).toBe(productId)
    })

    it('should fetch reviews by user ID', async () => {
      // Create several reviews for the same user
      const customerId = 3

      // Create first review
      const request1 = {
        product_id: 1,
        customer_id: customerId,
        rating: 5,
        title: 'First user review',
        content: 'First user review content',
      }
      await store(request1)

      // Create second review
      const request2 = {
        product_id: 2,
        customer_id: customerId,
        rating: 3,
        title: 'Second user review',
        content: 'Second user review content',
      }
      await store(request2)

      // Now fetch reviews by user ID
      const result = await fetchByUserId(customerId)

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      expect(result[0].customer_id).toBe(customerId)
      expect(result[1].customer_id).toBe(customerId)
    })

    it('should fetch approved reviews for a product', async () => {
      const productId = 3

      // Create approved review
      const request1 = {
        product_id: productId,
        customer_id: 1,
        rating: 5,
        title: 'Approved review',
        content: 'Approved review content',
        is_approved: true,
      }

      await store(request1)

      // Create unapproved review
      const request2 = {
        product_id: productId,
        customer_id: 2,
        rating: 2,
        title: 'Unapproved review',
        content: 'Unapproved review content',
        is_approved: false,
      }

      await store(request2)

      // Now fetch only approved reviews
      const result = await fetchApprovedByProductId(productId)

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(Boolean(result[0].is_approved)).toBe(true)
      expect(result[0].title).toBe('Approved review')
    })

    it('should fetch most helpful reviews', async () => {
      const productId = 5

      // Create review with many helpful votes
      const request1 = {
        product_id: productId,
        customer_id: 1,
        rating: 5,
        title: 'Most helpful review',
        content: 'Very helpful content',
        is_approved: true,
        helpful_votes: 10,
      }

      await store(request1)

      // Create review with fewer helpful votes
      const request2 = {
        product_id: productId,
        customer_id: 2,
        rating: 4,
        title: 'Less helpful review',
        content: 'Still helpful content',
        is_approved: true,
        helpful_votes: 5,
      }

      await store(request2)

      // Now fetch most helpful reviews
      const helpfulReviews = await fetchMostHelpfulByProductId(productId)

      expect(helpfulReviews).toBeDefined()
      expect(helpfulReviews.length).toBe(2)
      expect(helpfulReviews[0].helpful_votes).toBe(10)
      expect(helpfulReviews[1].helpful_votes).toBe(5)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of reviews', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
