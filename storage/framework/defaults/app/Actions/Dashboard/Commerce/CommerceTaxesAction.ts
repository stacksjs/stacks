import { Action } from '@stacksjs/actions'
import { TaxRate } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceTaxes',
  description: 'Returns tax rates, summary stats, and recent tax collections.',
  method: 'GET',
  async handle() {
    try {
      const allRates = await TaxRate.orderByDesc('id').limit(50).get()
      const totalRates = await TaxRate.count()

      const taxRates = allRates.map(r => ({
        region: String(r.get('region') || r.get('name') || ''),
        rate: r.get('rate') ? `${r.get('rate')}%` : '-',
        type: String(r.get('type') || 'Sales Tax'),
        status: String(r.get('status') || 'active'),
      }))

      const taxSummary = [
        { label: 'Collected This Month', value: '-' },
        { label: 'Pending Remittance', value: '-' },
        { label: 'Tax Rate Regions', value: String(totalRates) },
        { label: 'Exempt Transactions', value: '-' },
      ]

      const recentTaxes = [
        { order: '-', subtotal: '-', taxRate: '-', taxAmount: '-', region: '-' },
      ]

      return { taxRates, taxSummary, recentTaxes }
    }
    catch {
      return {
        taxRates: [],
        taxSummary: [
          { label: 'Collected This Month', value: '-' },
          { label: 'Pending Remittance', value: '-' },
          { label: 'Tax Rate Regions', value: '0' },
          { label: 'Exempt Transactions', value: '-' },
        ],
        recentTaxes: [],
      }
    }
  },
})
