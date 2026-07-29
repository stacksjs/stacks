import { Action } from '@stacksjs/actions'
import { TaxRate } from '@stacksjs/orm'
import { normalizeTaxRateRecord, summarizeTaxRates } from './tax-rate-records'

export default new Action({
  name: 'CommerceTaxesAction',
  description: 'Returns persisted TaxRate records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const rates = await TaxRate.orderByDesc('id').limit(500).get()
    const records = rates.map(normalizeTaxRateRecord)
    return {
      records,
      summary: summarizeTaxRates(records),
    }
  },
})
