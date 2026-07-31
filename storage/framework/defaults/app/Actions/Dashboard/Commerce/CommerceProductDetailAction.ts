import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Manufacturer, Product, ProductUnit, ProductVariant, Review } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  countProductRelations,
  normalizeCommerceCurrency,
  normalizeCommerceProductRecord,
  normalizeManufacturerOption,
  normalizeProductOption,
  normalizeProductUnitDetail,
  normalizeProductVariantDetail,
  summarizeProductReviews,
} from './commerce-product-records'

export default new Action({
  name: 'CommerceProductDetailAction',
  description: 'Returns one persisted Product with its native variants, units, reviews, and edit options.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0)
      return response.notFound({ error: 'Product not found' })

    try {
      const product = await Product.find(id)
      if (!product)
        return response.notFound({ error: 'Product not found' })

      const [categories, manufacturers, variants, units, reviews] = await Promise.all([
        Category.orderBy('name', 'asc').limit(500).get(),
        Manufacturer.orderBy('manufacturer', 'asc').limit(500).get(),
        ProductVariant.where('product_id', id).get(),
        ProductUnit.where('product_id', id).get(),
        Review.where('product_id', id).get(),
      ])
      const categoryOptions = categories.map(normalizeProductOption)
      const manufacturerOptions = manufacturers.map(normalizeManufacturerOption)
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
        defaultCurrency: normalizeCommerceCurrency((config as any).commerce?.currency),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Product details could not be read.',
      }, 503)
    }
  },
})
