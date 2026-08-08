import { db } from '@stacksjs/database'

/**
 * What a product page prints above its review list.
 *
 * The module could already fetch review rows but not say anything about them,
 * so every storefront ended up summing ratings in a template - and each one
 * had to rediscover that an unrated review must be skipped rather than counted
 * as a zero, which silently drags an average down.
 */
export interface ReviewStats {
  /** Reviews of any shape: rated, written, or both. */
  total: number
  /** Reviews carrying a star rating. The denominator of `average`. */
  rated: number
  /** Reviews with something written but no star. */
  commentsOnly: number
  /** Mean of the rated reviews, to one decimal place. Zero when none are rated. */
  average: number
  /** How many gave one star, two, and so on. Always has all five keys. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/** A product with no reviews yet, so callers never branch on undefined. */
function emptyStats(): ReviewStats {
  return {
    total: 0,
    rated: 0,
    commentsOnly: 0,
    average: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }
}

/**
 * Roll a set of rows into one summary.
 *
 * Ratings are rounded to the nearest whole star for the distribution, because
 * the column is a REAL and a half-star from an imported dataset still has to
 * land in one of the five bars.
 */
function summarise(rows: { rating: number | null }[]): ReviewStats {
  const stats = emptyStats()
  stats.total = rows.length

  let sum = 0

  for (const row of rows) {
    // Not `!row.rating`: that treats a legitimate 0 the same as "unrated", and
    // while the model floors at 1, imported data does not always agree.
    if (row.rating === null || row.rating === undefined) {
      stats.commentsOnly++
      continue
    }

    const rating = Number(row.rating)
    if (Number.isNaN(rating)) {
      stats.commentsOnly++
      continue
    }

    stats.rated++
    sum += rating

    const star = Math.min(5, Math.max(1, Math.round(rating))) as 1 | 2 | 3 | 4 | 5
    stats.distribution[star]++
  }

  if (stats.rated > 0)
    stats.average = Math.round((sum / stats.rated) * 10) / 10

  return stats
}

/**
 * Summarise the approved reviews for one product.
 *
 * Only approved rows count. A pending review is not yet something the shop has
 * agreed to publish, and letting it move the average is how a single
 * unmoderated one-star lands on a listing page before anyone has read it.
 */
export async function fetchStats(productId: number): Promise<ReviewStats> {
  const rows = await db
    .selectFrom('reviews')
    .select(['rating'])
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .execute()

  return summarise(rows as { rating: number | null }[])
}

/**
 * The same, for many products in one query.
 *
 * A listing page showing a star line per card would otherwise call
 * `fetchStats` once per product, which is the N+1 that makes a menu of fifty
 * products fifty-one round trips. Products with no reviews are still present
 * in the result, holding an empty summary, so a caller can index into it
 * without checking.
 */
export async function fetchStatsByProductIds(
  productIds: number[],
): Promise<Map<number, ReviewStats>> {
  const stats = new Map<number, ReviewStats>()
  for (const id of productIds)
    stats.set(id, emptyStats())

  if (productIds.length === 0)
    return stats

  const rows = await db
    .selectFrom('reviews')
    .select(['product_id', 'rating'])
    .where('product_id', 'in', productIds)
    .where('is_approved', '=', true)
    .execute()

  const grouped = new Map<number, { rating: number | null }[]>()
  for (const row of rows as { product_id: number, rating: number | null }[]) {
    const bucket = grouped.get(row.product_id)
    if (bucket)
      bucket.push({ rating: row.rating })
    else
      grouped.set(row.product_id, [{ rating: row.rating }])
  }

  for (const [productId, bucket] of grouped)
    stats.set(productId, summarise(bucket))

  return stats
}
