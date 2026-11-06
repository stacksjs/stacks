import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { Category, Manufacturer, Product, ProductUnit, ProductVariant, Review } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  commerceRecordIdentifier,
  countProductRelations,
  normalizeCommerceCurrency,
  normalizeCommerceProductRecord,
  normalizeManufacturerOption,
  normalizeProductOption,
  summarizeCommerceProducts,
} from './commerce-product-records'
import { referencedIds } from './commerce-record'

export default new Action({
  name: 'CommerceProductsAction',
  description: 'Returns persisted Product records with native relationship context for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const products = await Product.orderByDesc('id').limit(500).get()
      const productIds = products.map(product => commerceRecordIdentifier(product, 'Product'))
      // Identifiers normalize to strings; `product_id` is numeric.
      const numericProductIds = productIds.map(Number).filter(Number.isSafeInteger)
      // The categories and manufacturers these products reference, read by id.
      // A product whose category or manufacturer is missing from what it is
      // given is refused (normalizeCommerceProductRecord), and these came from
      // the first 500 of each, so one product in the 501st category failed the
      // whole Products page (stacksjs/stacks#3218).
      const categoryReferences = referencedIds(products, 'category_id', 'categoryId')
      const manufacturerReferences = referencedIds(products, 'manufacturer_id', 'manufacturerId')
      const [categories, manufacturers, referencedCategories, referencedManufacturers, variants, units, reviews] = await Promise.all([
        // The product dialog's choices.
        Category.orderBy('name', 'asc').limit(500).get(),
        Manufacturer.orderBy('manufacturer', 'asc').limit(500).get(),
        categoryReferences.length > 0 ? Category.whereIn('id', categoryReferences).get() : [],
        manufacturerReferences.length > 0 ? Manufacturer.whereIn('id', manufacturerReferences).get() : [],
        numericProductIds.length > 0 ? ProductVariant.whereIn('product_id', numericProductIds).get() : [],
        numericProductIds.length > 0 ? ProductUnit.whereIn('product_id', numericProductIds).get() : [],
        numericProductIds.length > 0 ? Review.whereIn('product_id', numericProductIds).get() : [],
      ])
      const categoryOptions = categories.map(normalizeProductOption)
      const manufacturerOptions = manufacturers.map(normalizeManufacturerOption)
      const categoryMap = new Map(referencedCategories.map(normalizeProductOption).map(option => [option.id, option.label]))
      const manufacturerMap = new Map(referencedManufacturers.map(normalizeManufacturerOption).map(option => [option.id, option.label]))
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
        defaultCurrency: normalizeCommerceCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product records could not be read.', 'CommerceProductsAction')
    }
  },
})
