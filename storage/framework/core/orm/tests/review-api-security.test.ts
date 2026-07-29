import { describe, expect, test } from 'bun:test'
import Review from '../../../defaults/app/Models/commerce/Review'

describe('review model API security', () => {
  test('requires authentication for review reads and moderation writes', () => {
    expect(Review.traits.useApi).toMatchObject({
      uri: 'product-reviews',
      middleware: ['auth'],
    })
  })
})
