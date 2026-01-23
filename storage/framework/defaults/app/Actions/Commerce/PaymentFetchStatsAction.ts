import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Statistics',
  description: 'Fetch payment statistics for a given time period',
  method: 'GET',

  async handle() {
    const stats = await payments.fetchPaymentStats(30) // Default to 30 days

    return response.json({
      transactions: {
        count: stats.total_transactions,
        comparison: stats.comparison.transactions,
      },
      success_rate: {
        percentage: stats.successful_rate,
      },
      revenue: {
        total: stats.total_revenue,
        comparison: stats.comparison.revenue,
      },
      average_transaction: {
        amount: stats.average_transaction,
        comparison: stats.comparison.average,
      },
    })
  },
})
