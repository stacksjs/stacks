import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { dashboardOperationalError } from '../dashboard-response'
import { readPosSettings } from './commerce-pos-catalog'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/pos` - the point of sale's settings: the
 * categories in use, the tax rate, the currency, the payment methods and the
 * catalogue summary, counted over every product (commerce-pos-catalog.ts,
 * stacksjs/stacks#3218).
 *
 * The catalogue itself is GET /commerce/pos/products, searched and paged, and
 * the checkout searches customers through GET /commerce/customer-choices.
 * This used to send the first 500 products, categories, manufacturers,
 * customers and tax rates.
 */
export default new Action({
  name: 'CommercePosAction',
  description: 'Returns the native point of sale settings and catalogue summary.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const settings = await readPosSettings()
      return {
        categories: settings.categories,
        taxRate: settings.taxRate,
        defaultCurrency: normalizeCommerceCurrency(config.commerce?.currency),
        paymentMethods: [{ id: 'cash', label: 'Cash' }],
        summary: settings.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Point of sale records could not be read.', 'CommercePosAction')
    }
  },
})
