import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Monthly Trends',
  description: 'Fetch monthly payment trends for the last 12 months',
  method: 'GET',

  async handle() {
    const trends = await payments.fetchMonthlyPaymentTrends()

    return response.json({
      trends: trends.map(trend => ({
        month: `${trend.year}-${trend.month}`,
        transactions: trend.transactions,
        revenue: trend.revenue,
      })),
    })
  },
})
