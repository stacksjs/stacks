import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../products/reviews/destroy'
import { fetchApprovedByProductId, fetchById, fetchByProductId, fetchByUserId, fetchMostHelpfulByProductId } from '../products/reviews/fetch'
import { store } from '../products/reviews/store'
import { update, updateVotes } from '../products/reviews/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Review Module', () => {
  describe('store', () => {
    it('should create a new product review in the database', async () => {
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 5,
        title: 'Great product',
        content: 'This is an excellent product, highly recommend!',
        is_verified_purchase: true,
        is_approved: true,
        is_featured: true,
        helpful_votes: 0,
        unhelpful_votes: 0,
        purchase_date: formatDate(new Date()),
      }

      const review = await store(requestData)

      expect(review).toBeDefined()
      expect(review?.product_id).toBe(1)
      expect(review?.customer_id).toBe(1)
      expect(review?.rating).toBe(5)
      expect(review?.title).toBe('Great product')
      expect(review?.content).toBe('This is an excellent product, highly recommend!')
      expect(Boolean(review?.is_verified_purchase)).toBe(true)
      expect(Boolean(review?.is_approved)).toBe(true)
      expect(Boolean(review?.is_featured)).toBe(true)

      // Save the ID for further testing
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Verify we can fetch the review we just created
      if (reviewId) {
        const fetchedReview = await fetchById(reviewId)
        expect(fetchedReview).toBeDefined()
        expect(fetchedReview?.id).toBe(reviewId)
      }
    })

    it('should create a review with default values when optional fields are missing', async () => {
      // Create a review with only required fields
      const minimalRequestData = {
        product_id: 1,
        customer_id: 2,
        rating: 4,
        title: 'Good product',
        content: 'I like it',
      }

      const review = await store(minimalRequestData)

      expect(review).toBeDefined()
      expect(review?.product_id).toBe(1)
      expect(review?.customer_id).toBe(2)
      expect(review?.rating).toBe(4)
      expect(review?.title).toBe('Good product')
      expect(review?.content).toBe('I like it')
      expect(review?.helpful_votes).toBe(0) // Default value
      expect(review?.unhelpful_votes).toBe(0) // Default value
      expect(Boolean(review?.is_featured)).toBe(false) // Default value should be false
    })
  })

  describe('fetch methods', () => {
    it('should fetch a review by ID', async () => {
      // First create a review to fetch
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 5,
        title: 'Great product',
        content: 'This is an excellent product!',
        is_verified_purchase: true,
        is_approved: true,
      }

      const review = await store(requestData)
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Make sure we have a valid review ID before proceeding
      expect(reviewId).toBeDefined()
      if (!reviewId) {
        throw new Error('Failed to create test review')
      }

      // Now fetch the review by ID
      const fetchedReview = await fetchById(reviewId)

      expect(fetchedReview).toBeDefined()
      expect(fetchedReview?.id).toBe(reviewId)
      expect(fetchedReview?.title).toBe('Great product')
      expect(fetchedReview?.rating).toBe(5)
    })

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

    // it('should fetch product review statistics', async () => {
    //   const productId = 4

    //   // Create several reviews with different ratings
    //   const request1 = {
    //     product_id: productId,
    //     customer_id: 1,
    //     rating: 5,
    //     title: 'Five star review',
    //     content: 'Excellent!',
    //     is_approved: true,
    //   }

    //   await store(request1)

    //   const request2 = {
    //     product_id: productId,
    //     customer_id: 2,
    //     rating: 4,
    //     title: 'Four star review',
    //     content: 'Pretty good!',
    //     is_approved: true,
    //   }

    //   await store(request2)

    //   const request3 = {
    //     product_id: productId,
    //     customer_id: 3,
    //     rating: 3,
    //     title: 'Three star review',
    //     content: 'Average',
    //     is_approved: true,
    //   }

    //   await store(request3)

    //   // Now fetch review statistics
    //   const stats = await fetchReviewStats(productId)

    //   expect(stats).toBeDefined()
    //   expect(stats.total).toBe(3)
    //   expect(stats.average_rating).toBeCloseTo(4) // (5+4+3)/3 = 4
    //   expect(stats.rating_distribution.five_star).toBe(1)
    //   expect(stats.rating_distribution.four_star).toBe(1)
    //   expect(stats.rating_distribution.three_star).toBe(1)
    //   expect(stats.recent_reviews.length).toBe(3)
    // })

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

    it('should correctly handle the is_featured flag', async () => {
      const productId = 6

      // Create featured review
      const request1 = {
        product_id: productId,
        customer_id: 1,
        rating: 5,
        title: 'Featured review',
        content: 'This is a featured review',
        is_approved: true,
        is_featured: true,
      }
      await store(request1)

      // Create non-featured review
      const request2 = {
        product_id: productId,
        customer_id: 2,
        rating: 4,
        title: 'Regular review',
        content: 'This is a regular review',
        is_approved: true,
        is_featured: false,
      }
      await store(request2)

      // Fetch all reviews for this product
      const result = await fetchByProductId(productId)

      // Verify both reviews exist
      expect(result).toBeDefined()
      expect(result.length).toBe(2)

      // Find the featured review
      const featuredReview = result.find(review => Boolean(review.is_featured) === true)
      expect(featuredReview).toBeDefined()
      expect(featuredReview?.title).toBe('Featured review')

      // Find the non-featured review
      const regularReview = result.find(review => Boolean(review.is_featured) === false)
      expect(regularReview).toBeDefined()
      expect(regularReview?.title).toBe('Regular review')

      // Test updating featured status
      if (regularReview?.id) {
        const updateData = {
          is_featured: true,
        }

        const updatedReview = await update(Number(regularReview.id), updateData)

        expect(updatedReview).toBeDefined()
        expect(Boolean(updatedReview?.is_featured)).toBe(true)
      }
    })
  })

  describe('update', () => {
    it('should update an existing review', async () => {
      // First create a review to update
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 3,
        title: 'Initial review',
        content: 'Initial content',
        is_approved: false,
        is_featured: false,
      }

      // Create the review
      const review = await store(requestData)
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Make sure we have a valid review ID before proceeding
      expect(reviewId).toBeDefined()
      if (!reviewId) {
        throw new Error('Failed to create test review')
      }

      // Update the review with new data
      const updateData = {
        rating: 4,
        title: 'Updated title',
        content: 'Updated content',
        is_approved: true,
        is_featured: true,
      }

      const updatedReview = await update(reviewId, updateData)

      // Verify the update was successful
      expect(updatedReview).toBeDefined()
      expect(updatedReview?.id).toBe(reviewId)
      expect(updatedReview?.rating).toBe(4)
      expect(updatedReview?.title).toBe('Updated title')
      expect(updatedReview?.content).toBe('Updated content')
      expect(Boolean(updatedReview?.is_approved)).toBe(true)
      expect(Boolean(updatedReview?.is_featured)).toBe(true)

      // The original fields should remain unchanged
      expect(updatedReview?.product_id).toBe(1)
      expect(updatedReview?.customer_id).toBe(1)
    })

    it('should update a review\'s vote counts', async () => {
      // Create a review with initial vote counts
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 5,
        title: 'Review with votes',
        content: 'This is a review that will receive votes',
        is_approved: true,
        helpful_votes: 3,
        unhelpful_votes: 1,
      }

      const review = await store(requestData)
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Make sure we have a valid review ID before proceeding
      expect(reviewId).toBeDefined()
      if (!reviewId) {
        throw new Error('Failed to create test review')
      }

      // Increment helpful votes
      const reviewWithMoreHelpfulVotes = await updateVotes(reviewId, 'helpful', true)
      expect(reviewWithMoreHelpfulVotes?.helpful_votes).toBe(4)
      expect(reviewWithMoreHelpfulVotes?.unhelpful_votes).toBe(1)

      // Increment unhelpful votes
      const reviewWithMoreUnhelpfulVotes = await updateVotes(reviewId, 'unhelpful', true)
      expect(reviewWithMoreUnhelpfulVotes?.helpful_votes).toBe(4)
      expect(reviewWithMoreUnhelpfulVotes?.unhelpful_votes).toBe(2)

      // Decrement helpful votes
      const reviewWithLessHelpfulVotes = await updateVotes(reviewId, 'helpful', false)
      expect(reviewWithLessHelpfulVotes?.helpful_votes).toBe(3)
      expect(reviewWithLessHelpfulVotes?.unhelpful_votes).toBe(2)
    })

    it('should prevent vote counts from going below zero', async () => {
      // Create a review with zero votes
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 4,
        title: 'Zero votes review',
        content: 'This is a review with zero votes',
        is_approved: true,
        helpful_votes: 0,
        unhelpful_votes: 0,
      }

      const review = await store(requestData)
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Make sure we have a valid review ID before proceeding
      expect(reviewId).toBeDefined()
      if (!reviewId) {
        throw new Error('Failed to create test review')
      }

      // Try to decrement helpful votes below zero
      const reviewAfterDecrement = await updateVotes(reviewId, 'helpful', false)
      expect(reviewAfterDecrement?.helpful_votes).toBe(0) // Should not go below zero
    })
  })

  describe('destroy', () => {
    it('should delete a review from the database', async () => {
      // First create a review to delete
      const requestData = {
        product_id: 1,
        customer_id: 1,
        rating: 3,
        title: 'Review to delete',
        content: 'This review will be deleted',
      }

      // Create the review
      const review = await store(requestData)
      const reviewId = review?.id !== undefined ? Number(review.id) : undefined

      // Make sure we have a valid review ID before proceeding
      expect(reviewId).toBeDefined()
      if (!reviewId) {
        throw new Error('Failed to create test review')
      }

      // Verify the review exists
      let fetchedReview = await fetchById(reviewId)
      expect(fetchedReview).toBeDefined()

      // Delete the review
      const result = await destroy(reviewId)
      expect(result).toBe(true)

      // Verify the review no longer exists
      fetchedReview = await fetchById(reviewId)
      expect(fetchedReview).toBeUndefined()
    })

    it('should delete multiple reviews from the database', async () => {
      // Create several reviews to delete
      const reviewIds = []

      // Create 3 test reviews
      for (let i = 0; i < 3; i++) {
        const requestData = {
          product_id: 1,
          customer_id: i + 1,
          rating: 4,
          title: `Bulk delete review ${i}`,
          content: `This is review ${i} for bulk deletion`,
        }

        const review = await store(requestData)

        const reviewId = review?.id !== undefined ? Number(review.id) : undefined
        expect(reviewId).toBeDefined()

        if (reviewId) {
          reviewIds.push(reviewId)
        }
      }

      // Ensure we have created the reviews
      expect(reviewIds.length).toBe(3)

      // Delete the reviews
      const deletedCount = await bulkDestroy(reviewIds)
      expect(deletedCount).toBe(3)

      // Verify the reviews no longer exist
      for (const id of reviewIds) {
        const fetchedReview = await fetchById(id)
        expect(fetchedReview).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of reviews', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
