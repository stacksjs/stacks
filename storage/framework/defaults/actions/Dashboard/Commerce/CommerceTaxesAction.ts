import { Action } from '@stacksjs/actions'
import { TaxRate } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceTaxes',
  description: 'Returns tax rates, summary stats, and recent tax collections.',
  method: 'GET',
  async handle() {
    const items = await TaxRate.orderBy('created_at', 'desc').limit(50).get()
    const count = await TaxRate.count()

    const taxSummary = [
      { label: 'Collected This Month', value: '-' },
      { label: 'Pending Remittance', value: '-' },
      { label: 'Tax Rate Regions', value: String(count) },
      { label: 'Exempt Transactions', value: '-' },
    ]

    return {
      taxRates: items.map(i => i.toJSON()),
      taxSummary,
    }
  },
})
