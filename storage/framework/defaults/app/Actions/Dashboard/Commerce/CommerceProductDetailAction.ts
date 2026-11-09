import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { Product, ProductUnit, ProductVariant, Review } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  countProductRelations,
  normalizeCommerceCurrency,
  normalizeCommerceProductRecord,
  normalizeProductUnitDetail,
  normalizeProductVariantDetail,
  summarizeProductReviews,
} from './commerce-product-records'
import { readProductOptions } from './commerce-product-list'

export default new Action({
  name: 'CommerceProductDetailAction',
  description: 'Returns one persisted Product with its native variants, units, reviews, and edit options.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.notFound('Product not found')

    try {
      const product = await Product.find(id)
      if (!product)
        return response.notFound('Product not found')

      // Every category and manufacturer, for the edit dialog and to name the
      // product's own; this used to read the first 500 of each by name, so a
      // product in a later one failed its page (stacksjs/stacks#3218).
      const [options, variants, units, reviews] = await Promise.all([
        readProductOptions(),
        ProductVariant.where('product_id', id).get(),
        ProductUnit.where('product_id', id).get(),
        Review.where('product_id', id).get(),
      ])
      const categoryOptions = options.categories
      const manufacturerOptions = options.manufacturers
      const categoryMap = new Map(categoryOptions.map(option => [option.id, option.label]))
      const manufacturerMap = new Map(manufacturerOptions.map(option => [option.id, option.label]))
      const record = normalizeCommerceProductRecord(
        product,
        categoryMap,
        manufacturerMap,
        countProductRelations(variants),
        countProductRelations(units),
        countProductRelations(reviews),
      )

      return {
        record,
        variants: variants.map(normalizeProductVariantDetail),
        units: units.map(normalizeProductUnitDetail),
        reviews: summarizeProductReviews(reviews),
        categories: categoryOptions,
        manufacturers: manufacturerOptions,
        defaultCurrency: normalizeCommerceCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product details could not be read.', 'CommerceProductDetailAction')
    }
  },
})
