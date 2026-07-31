import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Manufacturer, Product, ProductUnit, ProductVariant, Review } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  commerceRecordIdentifier,
  countProductRelations,
  normalizeCommerceCurrency,
  normalizeCommerceProductRecord,
  normalizeManufacturerOption,
  normalizeProductOption,
  summarizeCommerceProducts,
} from './commerce-product-records'

export default new Action({
  name: 'CommerceProductsAction',
  description: 'Returns persisted Product records with native relationship context for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const products = await Product.orderByDesc('id').limit(500).get()
      const productIds = products.map(product => commerceRecordIdentifier(product, 'Product'))
      const [categories, manufacturers, variants, units, reviews] = await Promise.all([
        Category.orderBy('name', 'asc').limit(500).get(),
        Manufacturer.orderBy('manufacturer', 'asc').limit(500).get(),
        productIds.length > 0 ? ProductVariant.where('product_id', 'in', productIds).get() : [],
        productIds.length > 0 ? ProductUnit.where('product_id', 'in', productIds).get() : [],
        productIds.length > 0 ? Review.where('product_id', 'in', productIds).get() : [],
      ])
      const categoryOptions = categories.map(normalizeProductOption)
      const manufacturerOptions = manufacturers.map(normalizeManufacturerOption)
      const categoryMap = new Map(categoryOptions.map(option => [option.id, option.label]))
      const manufacturerMap = new Map(manufacturerOptions.map(option => [option.id, option.label]))
      const variantCounts = countProductRelations(variants)
      const unitCounts = countProductRelations(units)
      const reviewCounts = countProductRelations(reviews)
      const records = products.map(product => normalizeCommerceProductRecord(
        product,
        categoryMap,
        manufacturerMap,
        variantCounts,
        unitCounts,
        reviewCounts,
      ))

      return {
        records,
        summary: summarizeCommerceProducts(records),
        categories: categoryOptions,
        manufacturers: manufacturerOptions,
        defaultCurrency: normalizeCommerceCurrency((config as any).commerce?.currency),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Product records could not be read.',
      }, 503)
    }
  },
})
