import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'
import type { ReviewProductOption, ReviewRecord, ReviewSummary } from './review-records'
import { normalizeReviewCustomerContext, normalizeReviewProductOption, normalizeReviewRecord } from './review-records'

/**
 * One page of reviews, searched, filtered, sorted and counted by the database,
 * with the summary of every review (stacksjs/stacks#3218).
 *
 * The Reviews page used to read the newest 500 reviews and do all of that in
 * the browser, so a review past the 500th could not be found or moderated,
 * and the summary counted those 500. It also read the first 500 products and
 * customers by name, so one review of any later product or by any later
 * customer failed the whole page.
 */
export const REVIEW_SORTS = ['created', 'id', 'customer', 'product', 'rating', 'helpful', 'approved'] as const
export type ReviewSort = typeof REVIEW_SORTS[number]

export const REVIEW_RATINGS = ['1', '2', '3', '4', '5', 'none'] as const
export const REVIEW_MODERATION = ['approved', 'pending', 'featured', 'verified'] as const

export interface ReviewListQuery {
  search: string
  /** A product id, or '' for any. */
  product: string
  /** '' for any. */
  rating: '' | typeof REVIEW_RATINGS[number]
  /** '' for any. */
  moderation: '' | typeof REVIEW_MODERATION[number]
  sort: ReviewSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseReviewListQuery(read: QueryReader): ReviewListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(REVIEW_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${REVIEW_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (['created', 'rating', 'helpful'].includes(sort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const product = queryText(read, 'product')
  if (product && !/^\d+$/.test(product))
    return { error: 'product must be a product id.' }

  const rating = queryText(read, 'rating')
  if (rating && !(REVIEW_RATINGS as readonly string[]).includes(rating))
    return { error: `rating must be one of ${REVIEW_RATINGS.join(', ')}.` }

  const moderation = queryText(read, 'moderation')
  if (moderation && !(REVIEW_MODERATION as readonly string[]).includes(moderation))
    return { error: `moderation must be one of ${REVIEW_MODERATION.join(', ')}.` }

  return {
    search,
    product,
    rating: rating as ReviewListQuery['rating'],
    moderation: moderation as ReviewListQuery['moderation'],
    sort: sort as ReviewSort,
    direction,
    page,
    perPage,
  }
}

const FROM = ' FROM reviews r LEFT JOIN products p ON p.id = r.product_id LEFT JOIN customers c ON c.id = r.customer_id'

function sortExpression(sort: ReviewSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'r.id'
    case 'customer': return `LOWER(COALESCE(c.name, ''))`
    case 'product': return `LOWER(COALESCE(p.name, ''))`
    case 'rating': return 'r.rating'
    case 'helpful': return 'r.helpful_votes'
    case 'approved': return `CASE WHEN ${isTrue('r.is_approved', dialect)} THEN 1 ELSE 0 END`
    default: return 'r.created_at'
  }
}

export function reviewFilter(query: Pick<ReviewListQuery, 'search' | 'product' | 'rating' | 'moderation'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.product)
    clauses.push(`r.product_id = ${bind(Number(query.product))}`)
  if (query.rating === 'none')
    clauses.push('r.rating IS NULL')
  else if (query.rating)
    clauses.push(`r.rating = ${bind(Number(query.rating))}`)
  if (query.moderation === 'approved')
    clauses.push(isTrue('r.is_approved', dialect))
  if (query.moderation === 'pending')
    clauses.push(`NOT (${isTrue('r.is_approved', dialect)})`)
  if (query.moderation === 'featured')
    clauses.push(isTrue('r.is_featured', dialect))
  if (query.moderation === 'verified')
    clauses.push(isTrue('r.is_verified_purchase', dialect))
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      `COALESCE(c.name, '')`,
      `COALESCE(c.email, '')`,
      `COALESCE(p.name, '')`,
      `COALESCE(r.title, '')`,
      `COALESCE(r.content, '')`,
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<ReviewListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Unrated reviews come last in both directions, as the page sorted them:
  // each dialect would put NULL at a different end.
  const unrated = query.sort === 'rating' ? 'CASE WHEN r.rating IS NULL THEN 1 ELSE 0 END ASC, ' : ''
  // Ties read newest first, as the page broke them; the id breaks every
  // remaining tie, so pages never repeat or skip a review.
  if (query.sort === 'created' || query.sort === 'id')
    return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, r.id ${direction}`
  return ` ORDER BY ${unrated}${sortExpression(query.sort, dialect)} ${direction}, r.created_at DESC, r.id DESC`
}

/** Reviews turned into records, against exactly the products and customers they reference. */
async function recordsFor(reviews: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ReviewRecord[]> {
  if (reviews.length === 0)
    return []
  const productIds = referencedIds(reviews, 'product_id')
  const customerIds = referencedIds(reviews, 'customer_id')
  const [products, customers] = await Promise.all([
    productIds.length > 0 ? run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(productIds, dialect)})`, productIds).execute() : [],
    customerIds.length > 0 ? run.unsafe(`SELECT id, name, email FROM customers WHERE id IN (${idPlaceholders(customerIds, dialect)})`, customerIds).execute() : [],
  ])
  const productMap = new Map(sqlRows(products).map(normalizeReviewProductOption).map(option => [option.id, { name: option.label }]))
  const customerMap = new Map(sqlRows(customers).map(normalizeReviewCustomerContext).map(customer => [customer.id, customer.context]))
  return reviews.map(review => normalizeReviewRecord(review, productMap, customerMap))
}

/** The summary cards, over every review as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ReviewSummary> {
  const count = (condition: string) => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, ${count(isTrue('is_approved', dialect))} AS approved_count, ${count(isTrue('is_featured', dialect))} AS featured_count, ${count(isTrue('is_verified_purchase', dialect))} AS verified_count, COUNT(rating) AS rated_count, SUM(rating) AS rating_total FROM reviews`,
  ).execute())[0] ?? {}
  const total = countOf(row.total_count)
  const approved = countOf(row.approved_count)
  const rated = countOf(row.rated_count)
  return {
    total,
    approved,
    pending: total - approved,
    featured: countOf(row.featured_count),
    verified: countOf(row.verified_count),
    // An unrated review is a review, not a 0-star one, so the average is
    // taken over the rated reviews only, as summarizeReviews does.
    averageRating: rated > 0 ? Math.round(countOf(row.rating_total) / rated * 10) / 10 : 0,
  }
}

/**
 * The product filter's choices: every product that has a review, read whole.
 * The page listed the first 500 products by name, reviewed or not.
 */
async function reviewedProducts(run: CommerceSqlRunner): Promise<ReviewProductOption[]> {
  const rows = sqlRows(await run.unsafe(
    // LOWER, so the order is the same on every dialect: each collates case its own way.
    'SELECT p.id, p.name FROM products p WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = p.id) ORDER BY LOWER(p.name) ASC, p.id ASC',
  ).execute())
  return rows.map(normalizeReviewProductOption)
}

export interface ReviewPage {
  records: ReviewRecord[]
  total: number
  page: number
  summary: ReviewSummary
  products: ReviewProductOption[]
}

export async function readReviewPage(
  query: ReviewListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<ReviewPage> {
  const { where, values } = reviewFilter(query, dialect)
  const [counted, summary, products] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect),
    reviewedProducts(run),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const reviews = await run.unsafe(
    `SELECT r.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(reviews), run, dialect), total, page, summary, products }
}
