import { Action } from '@stacksjs/actions/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import { readManufacturers } from './commerce-manufacturer-list'

/**
 * `GET /api/dashboard/commerce/manufacturers` - every manufacturer with how
 * many products it makes, counted by the database (commerce-manufacturer-list.ts,
 * stacksjs/stacks#3218). This used to read the newest 500 manufacturers and
 * count over the first 500 products.
 */
export default new Action({
  name: 'ManufacturerIndexAction',
  description: 'Returns persisted manufacturers with linked product counts for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await readManufacturers()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Manufacturer records could not be read.', 'ManufacturerIndexAction')
    }
  },
})
