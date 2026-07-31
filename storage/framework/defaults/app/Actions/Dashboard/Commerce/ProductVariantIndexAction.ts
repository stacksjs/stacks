import { Action } from '@stacksjs/actions'
import { Product, ProductVariant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  normalizeProductVariantRecord,
  productVariantOptions,
  summarizeProductVariants,
} from './product-variant-records'

export default new Action({
  name: 'ProductVariantIndexAction',
  description: 'Returns persisted product variants and product relationships for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [variants, products] = await Promise.all([
        ProductVariant.orderByDesc('id').limit(500).get(),
        Product.orderBy('name').limit(500).get(),
      ])
      const productOptions = productVariantOptions(products)
      const productNames = new Map(productOptions.map(product => [product.id, product.name]))
      const records = variants.map(variant => normalizeProductVariantRecord(variant, productNames))
      return {
        records,
        products: productOptions,
        summary: summarizeProductVariants(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Product variant records could not be read.',
      }, 503)
    }
  },
})
