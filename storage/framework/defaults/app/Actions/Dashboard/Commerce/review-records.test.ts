import { describe, expect, test } from 'bun:test'
import {
  normalizeReviewProductOption,
  normalizeReviewRecord,
  summarizeReviews,
} from './review-records'

describe('dashboard review records', () => {
  test('normalizes database columns and joins persisted relations', () => {
    const record = normalizeReviewRecord(
      {
        id: 9,
        product_id: 4,
        customer_id: 7,
        rating: 6,
        title: 'Useful',
        content: 'A recorded review',
        is_approved: 1,
        is_featured: false,
        is_verified_purchase: 'true',
        helpful_votes: 12,
        unhelpful_votes: -4,
        created_at: '2026-07-29 10:00:00',
      },
      new Map([['4', { name: 'Native Kit' }]]),
      new Map([['7', { name: 'Ada Lovelace', email: 'ada@example.test' }]]),
    )

    expect(record).toEqual({
      id: '9',
      productId: '4',
      productName: 'Native Kit',
      customerId: '7',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.test',
      rating: 5,
      title: 'Useful',
      content: 'A recorded review',
      approved: true,
      featured: false,
      verifiedPurchase: true,
      helpfulVotes: 12,
      unhelpfulVotes: 0,
      createdAt: '2026-07-29 10:00:00',
    })
  })

  test('uses honest relation fallbacks and summarizes moderation state', () => {
    const records = [
      normalizeReviewRecord({ id: 1, product_id: 3, rating: 4, is_approved: 1, is_featured: 1, is_verified_purchase: 1 }, new Map(), new Map()),
      normalizeReviewRecord({ id: 2, rating: 2, is_approved: 0 }, new Map(), new Map()),
    ]

    expect(records[0].productName).toBe('Product 3')
    expect(records[1].customerName).toBe('Guest customer')
    expect(summarizeReviews(records)).toEqual({
      total: 2,
      approved: 1,
      pending: 1,
      featured: 1,
      verified: 1,
      averageRating: 3,
    })
    expect(normalizeReviewProductOption({ id: 4, name: '' })).toEqual({ id: '4', label: 'Unnamed product' })
  })
})
