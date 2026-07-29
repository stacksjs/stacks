import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Manufacturer, Product, ProductUnit, ProductVariant, Review } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  countProductRelations,
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
    const categoryMap = new Map(categories.map(category => [String(category.get('id') || ''), String(category.get('name') || '')]))
    const manufacturerMap = new Map(manufacturers.map(manufacturer => [String(manufacturer.get('id') || ''), String(manufacturer.get('manufacturer') || '')]))
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
      categories: categories.map(normalizeProductOption),
      manufacturers: manufacturers.map(normalizeManufacturerOption),
      defaultCurrency: String((config as any).commerce?.currency || 'USD').toUpperCase(),
    }
  },
})
