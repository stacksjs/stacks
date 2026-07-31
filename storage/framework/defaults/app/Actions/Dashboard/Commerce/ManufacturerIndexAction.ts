import { Action } from '@stacksjs/actions'
import { Manufacturer, Product } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  manufacturerIdentifiers,
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
    try {
      const [manufacturers, products] = await Promise.all([
        Manufacturer.orderByDesc('id').limit(500).get(),
        Product.orderBy('id', 'asc').limit(500).get(),
      ])
      const productCounts = manufacturerProductCounts(products, manufacturerIdentifiers(manufacturers))
      const records = manufacturers.map(manufacturer =>
        normalizeManufacturerRecord(manufacturer, productCounts),
      )

      return {
        records,
        summary: summarizeManufacturers(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Manufacturer records could not be read.',
      }, 503)
    }
  },
})
