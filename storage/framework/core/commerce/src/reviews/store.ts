import type { ProductRequestType } from '@stacksjs/orm'
import type { NewProductReview, ProductReviewJsonResponse } from '../../../../orm/src/models/ProductReview'
import { db } from '@stacksjs/database'

/**
 * Create a new gift card
 *
 * @param request The gift card data to store
 * @returns The newly created gift card record
 */
export async function store(request: ProductRequestType): Promise<ProductReviewJsonResponse | undefined> {
  await request.validate()

  const productReviewData: NewProductReview = {
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
    const createdProductReview = await db
      .insertInto('product_reviews')
      .values(productReviewData)
      .executeTakeFirst()

    // If insert was successful, retrieve the newly created gift card
    if (createdProductReview.insertId) {
      const productReview = await db
        .selectFrom('product_reviews')
        .where('id', '=', Number(createdProductReview.insertId))
        .selectAll()
        .executeTakeFirst()

      return productReview
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A gift card with this code already exists')
      }

      throw new Error(`Failed to create gift card: ${error.message}`)
    }

    throw error
  }
}
