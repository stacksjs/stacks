import { Action } from '@stacksjs/actions'
import { Product, ProductUnit } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  normalizeProductUnitRecord,
  productUnitOptions,
  summarizeProductUnits,
} from './product-unit-records'

export default new Action({
  name: 'ProductUnitIndexAction',
  description: 'Returns persisted product units and their product relationships for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [units, products] = await Promise.all([
        ProductUnit.orderByDesc('id').limit(500).get(),
        Product.orderBy('name').limit(500).get(),
      ])
      const options = productUnitOptions(products)
      const productNames = new Map(options.map(product => [product.id, product.name]))
      const records = units.map(unit => normalizeProductUnitRecord(unit, productNames))

      return {
        records,
        products: options,
        summary: summarizeProductUnits(records),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product unit records could not be read.', 'ProductUnitIndexAction')
    }
  },
})
