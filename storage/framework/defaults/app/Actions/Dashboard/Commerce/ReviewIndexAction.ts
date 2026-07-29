import { Action } from '@stacksjs/actions'
import { Customer, Product, Review } from '@stacksjs/orm'
import {
  normalizeReviewProductOption,
  normalizeReviewRecord,
  summarizeReviews,
} from './review-records'

export default new Action({
  name: 'ReviewIndexAction',
  description: 'Returns persisted reviews with their product and customer context for dashboard moderation.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [reviews, products] = await Promise.all([
      Review.orderByDesc('id').limit(500).get(),
      Product.all(),
    ])
    const customerIds = reviews
      .map(review => Number(review.get('customer_id')))
      .filter(id => Number.isFinite(id) && id > 0)
    const customers = customerIds.length > 0
      ? await Customer.where('id', 'in', customerIds).get()
      : []
    const productMap = new Map(products.map(product => [
      String(product.get('id') || ''),
      { name: String(product.get('name') || '') },
    ]))
    const customerMap = new Map(customers.map(customer => [
      String(customer.get('id') || ''),
      {
        name: String(customer.get('name') || ''),
        email: String(customer.get('email') || ''),
      },
    ]))
    const records = reviews.map(review => normalizeReviewRecord(review, productMap, customerMap))

    return {
      records,
      summary: summarizeReviews(records),
      products: products
        .map(normalizeReviewProductOption)
        .sort((left, right) => left.label.localeCompare(right.label)),
    }
  },
})
