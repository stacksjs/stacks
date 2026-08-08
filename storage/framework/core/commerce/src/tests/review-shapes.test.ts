import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { fetchStats, fetchStatsByProductIds } from '../products/reviews/stats'
import { store } from '../products/reviews/store'

/**
 * A review is a rating, a written comment, or both.
 *
 * The model required a rating, so two of those three were impossible: a shop
 * that wanted written feedback had to invent a star to carry the words, then
 * filter its own invention back out of its averages. The column was always
 * nullable; only the validation rule disagreed.
 *
 * The other half of the rule cannot live on the model, because validation
 * there runs one attribute at a time: a row with neither a rating nor anything
 * written is not a review, and counting it inflates the review total on a
 * product nobody has said anything about. `store` rejects that.
 *
 * `fetchStats` is the summary a product page prints. Its one subtlety is that
 * an unrated review must be skipped rather than counted as zero — averaging it
 * in drags the score down for the crime of having no stars.
 */

beforeEach(async () => {
  await refreshDatabase()
})

describe('what shape a review may take', () => {
  it('accepts a rating with no comment', async () => {
    const review = await store({ product_id: 1, customer_id: 1, rating: 4 })

    expect(review.rating).toBe(4)
  })

  it('accepts a comment with no rating', async () => {
    const review = await store({
      product_id: 1,
      customer_id: 1,
      content: 'Staff talked me through the whole shelf. No rush at all.',
    })

    expect(review.rating).toBeNull()
    expect(review.content).toContain('No rush at all')
  })

  it('accepts a title with no rating and no body', async () => {
    const review = await store({ product_id: 1, customer_id: 1, title: 'Would buy again' })

    expect(review.rating).toBeNull()
  })

  it('accepts both together', async () => {
    const review = await store({
      product_id: 1,
      customer_id: 1,
      rating: 5,
      content: 'Exactly what it says on the jar.',
    })

    expect(review.rating).toBe(5)
    expect(review.content).toBe('Exactly what it says on the jar.')
  })

  it('rejects a review that says nothing at all', async () => {
    expect(store({ product_id: 1, customer_id: 1 })).rejects.toThrow(/rating or something written/)
  })

  it('rejects whitespace as if it were empty', async () => {
    expect(store({ product_id: 1, customer_id: 1, content: '   ', title: '  ' }))
      .rejects.toThrow(/rating or something written/)
  })

  it('records an absent rating as null rather than zero', async () => {
    // Zero is a rating a template will happily render as no stars filled in,
    // and it would drag an average down too.
    const review = await store({ product_id: 1, customer_id: 1, content: 'Good.' })

    expect(review.rating).toBeNull()
    expect(review.rating).not.toBe(0)
  })
})

describe('fetchStats', () => {
  it('describes a product with no reviews without needing a null check', async () => {
    const stats = await fetchStats(4242)

    expect(stats).toEqual({
      total: 0,
      rated: 0,
      commentsOnly: 0,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    })
  })

  it('averages only the reviews that carry a rating', async () => {
    await store({ product_id: 7, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 7, customer_id: 2, rating: 3, is_approved: true })
    // The one that would drag a naive average from 4.0 down to 2.7.
    await store({ product_id: 7, customer_id: 3, content: 'No stars from me, just words.', is_approved: true })

    const stats = await fetchStats(7)

    expect(stats.total).toBe(3)
    expect(stats.rated).toBe(2)
    expect(stats.commentsOnly).toBe(1)
    expect(stats.average).toBe(4)
  })

  it('counts every approved review in the total, rated or not', async () => {
    await store({ product_id: 8, customer_id: 1, rating: 4, is_approved: true })
    await store({ product_id: 8, customer_id: 2, content: 'Solid.', is_approved: true })

    expect((await fetchStats(8)).total).toBe(2)
  })

  it('buckets ratings into five stars', async () => {
    await store({ product_id: 9, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 9, customer_id: 2, rating: 5, is_approved: true })
    await store({ product_id: 9, customer_id: 3, rating: 2, is_approved: true })

    expect((await fetchStats(9)).distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 2 })
  })

  it('rounds a fractional rating into the nearest bar', async () => {
    // The column is a REAL, and imported data carries half stars.
    await store({ product_id: 10, customer_id: 1, rating: 4.5, is_approved: true })

    expect((await fetchStats(10)).distribution[5]).toBe(1)
  })

  it('rounds the average to one decimal place', async () => {
    await store({ product_id: 11, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 11, customer_id: 2, rating: 4, is_approved: true })
    await store({ product_id: 11, customer_id: 3, rating: 4, is_approved: true })

    expect((await fetchStats(11)).average).toBe(4.3)
  })

  it('ignores reviews that have not been approved', async () => {
    // Otherwise one unmoderated one-star reaches the listing page before
    // anybody has read it.
    await store({ product_id: 12, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 12, customer_id: 2, rating: 1, is_approved: false })

    const stats = await fetchStats(12)

    expect(stats.total).toBe(1)
    expect(stats.average).toBe(5)
  })
})

describe('fetchStatsByProductIds', () => {
  it('returns an entry for every product asked about, reviewed or not', async () => {
    await store({ product_id: 20, customer_id: 1, rating: 4, is_approved: true })

    const stats = await fetchStatsByProductIds([20, 21])

    expect(stats.get(20)?.average).toBe(4)
    expect(stats.get(21)?.total).toBe(0)
  })

  it('keeps each product to its own reviews', async () => {
    await store({ product_id: 30, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 31, customer_id: 2, rating: 1, is_approved: true })

    const stats = await fetchStatsByProductIds([30, 31])

    expect(stats.get(30)?.average).toBe(5)
    expect(stats.get(31)?.average).toBe(1)
  })

  it('handles being asked about nothing', async () => {
    expect((await fetchStatsByProductIds([])).size).toBe(0)
  })

  it('agrees with fetchStats one product at a time', async () => {
    await store({ product_id: 40, customer_id: 1, rating: 5, is_approved: true })
    await store({ product_id: 40, customer_id: 2, content: 'Words only.', is_approved: true })

    expect((await fetchStatsByProductIds([40])).get(40)).toEqual(await fetchStats(40))
  })
})
