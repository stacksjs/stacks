import { describe, expect, test } from 'bun:test'
import {
  normalizeReviewCustomerContext,
  normalizeReviewProductOption,
  normalizeReviewRecord,
  summarizeReviews,
} from './review-records'

function review(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 9,
    product_id: null,
    customer_id: null,
    rating: 5,
    title: 'Useful',
    content: 'A recorded review',
    is_approved: false,
    is_featured: false,
    is_verified_purchase: false,
    helpful_votes: 0,
    unhelpful_votes: 0,
    created_at: '2026-07-29 10:00:00',
    ...overrides,
  }
}

describe('dashboard review records', () => {
  test('normalizes database columns and joins persisted relations', () => {
    const record = normalizeReviewRecord(
      review({
        product_id: 4,
        customer_id: 7,
        is_approved: 1,
        is_verified_purchase: 'true',
        helpful_votes: 12,
        unhelpful_votes: 4,
      }),
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
      unhelpfulVotes: 4,
      createdAt: '2026-07-29T10:00:00.000Z',
    })
  })

  test('rejects corrupt values and missing relationships', () => {
    expect(() => normalizeReviewRecord(
      review({ rating: 6 }),
      new Map(),
      new Map(),
    )).toThrow('Review 9.rating must be at most 5')
    expect(() => normalizeReviewRecord(
      review({ product_id: 3 }),
      new Map(),
      new Map(),
    )).toThrow('Review 9.product_id references missing Product 3')
    expect(() => normalizeReviewRecord(
      review({ customer_id: 7 }),
      new Map(),
      new Map(),
    )).toThrow('Review 9.customer_id references missing Customer 7')
  })

  test('preserves unlinked guest state and summarizes moderation state', () => {
    const products = new Map([['3', { name: 'Native Kit' }]])
    const records = [
      normalizeReviewRecord(review({
        id: 1,
        product_id: 3,
        rating: 4,
        is_approved: 1,
        is_featured: 1,
        is_verified_purchase: 1,
      }), products, new Map()),
      normalizeReviewRecord(review({
        id: 2,
        rating: 2,
        title: '',
        content: '',
        is_approved: 0,
      }), products, new Map()),
    ]

    expect(records[1]?.customerName).toBe('')
    expect(records[1]?.title).toBe('')
    expect(summarizeReviews(records)).toEqual({
      total: 2,
      approved: 1,
      pending: 1,
      featured: 1,
      verified: 1,
      averageRating: 3,
    })
  })

  test('validates Product options and Customer context records', () => {
    expect(normalizeReviewProductOption({ id: 4, name: 'Native Kit' }))
      .toEqual({ id: '4', label: 'Native Kit' })
    expect(normalizeReviewCustomerContext({
      id: 7,
      name: 'Ada Lovelace',
      email: 'ada@example.test',
    })).toEqual({
      id: '7',
      context: { name: 'Ada Lovelace', email: 'ada@example.test' },
    })
    expect(() => normalizeReviewProductOption({ id: 4, name: '' }))
      .toThrow('Product 4.name must be a non-empty string')
  })
})
