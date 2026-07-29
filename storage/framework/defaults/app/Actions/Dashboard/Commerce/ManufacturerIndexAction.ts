import { Action } from '@stacksjs/actions'
import { Manufacturer, Product } from '@stacksjs/orm'
import {
  manufacturerProductCounts,
  normalizeManufacturerRecord,
  summarizeManufacturers,
} from './manufacturer-records'

export default new Action({
  name: 'ManufacturerIndexAction',
  description: 'Returns persisted manufacturers with linked product counts for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [manufacturers, products] = await Promise.all([
      Manufacturer.orderByDesc('id').limit(500).get(),
      Product.all(),
    ])
    const productCounts = manufacturerProductCounts(products)
    const records = manufacturers.map(manufacturer => normalizeManufacturerRecord(manufacturer, productCounts))

    return {
      records,
      summary: summarizeManufacturers(records),
    }
  },
})
