import { Action } from '@stacksjs/actions/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import { readTaxRates } from './commerce-tax-rate-list'

/**
 * `GET /api/dashboard/commerce/taxes` - every tax rate, read whole (commerce-tax-rate-list.ts,
 * stacksjs/stacks#3218). This used to send the newest 500.
 */
export default new Action({
  name: 'CommerceTaxesAction',
  description: 'Returns every persisted TaxRate record for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await readTaxRates()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Tax rate records could not be read.', 'CommerceTaxesAction')
    }
  },
})
