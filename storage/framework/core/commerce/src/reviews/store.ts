import type { ProductRequestType } from '@stacksjs/orm'
import type { NewReview, ReviewJsonResponse } from '../../../../orm/src/models/Review'
import { db } from '@stacksjs/database'

/**
 * Create a new gift card
 *
 * @param request The gift card data to store
 * @returns The newly created gift card record
 */
export async function store(request: ProductRequestType): Promise<ReviewJsonResponse | undefined> {
  await request.validate()

  const reviewData: NewReview = {
    product_id: request.get<number>('product_id'),
    customer_id: request.get<number>('customer_id'),
    rating: request.get<number>('rating'),
    title: request.get('title'),
    content: request.get('content'),
    is_verified_purchase: request.get<boolean>('is_verified_purchase'),
    is_approved: request.get<boolean>('is_approved'),
    helpful_votes: request.get<number>('helpful_votes'),
    unhelpful_votes: request.get<number>('unhelpful_votes'),
    purchase_date: request.get('purchase_date'),
    images: request.get('purchase_date'),
  }

  try {
    // Insert the gift card record
    const createdReview = await db
      .insertInto('reviews')
      .values(reviewData)
      .executeTakeFirst()

    const insertId = Number(createdReview.insertId) || Number(createdReview.numInsertedOrUpdatedRows)

    // If insert was successful, retrieve the newly created gift card
    if (insertId) {
      const review = await db
        .selectFrom('reviews')
        .where('id', '=', insertId)
        .selectAll()
        .executeTakeFirst()

      return review
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A review with this code already exists')
      }

      throw new Error(`Failed to create review: ${error.message}`)
    }

    throw error
  }
}
