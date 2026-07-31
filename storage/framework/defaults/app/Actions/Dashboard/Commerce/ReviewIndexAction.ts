import { Action } from '@stacksjs/actions'
import { Customer, Product, Review } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  normalizeReviewCustomerContext,
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
    try {
      const [reviews, products, customers] = await Promise.all([
        Review.orderByDesc('id').limit(500).get(),
        Product.orderBy('name', 'asc').limit(500).get(),
        Customer.orderBy('name', 'asc').limit(500).get(),
      ])
      const productOptions = products
        .map(normalizeReviewProductOption)
        .sort((left, right) => left.label.localeCompare(right.label))
      const productMap = new Map(productOptions.map(product => [
        product.id,
        { name: product.label },
      ]))
      const customerContexts = customers.map(normalizeReviewCustomerContext)
      const customerMap = new Map(customerContexts.map(customer => [
        customer.id,
        customer.context,
      ]))
      const records = reviews.map(review => normalizeReviewRecord(review, productMap, customerMap))

      return {
        records,
        summary: summarizeReviews(records),
        products: productOptions,
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Review records could not be read.',
      }, 503)
    }
  },
})
