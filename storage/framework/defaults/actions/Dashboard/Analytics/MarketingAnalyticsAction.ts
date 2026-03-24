import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MarketingAnalyticsAction',
  description: 'Returns marketing analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      campaigns: [
        { name: 'Spring Sale', channel: 'Email', sent: 12500, opened: 4375, clicked: 1250, converted: 312, revenue: 15600 },
        { name: 'Product Launch', channel: 'Social', impressions: 45000, clicks: 2250, converted: 450, revenue: 22500 },
      ],
      overview: {
        totalCampaigns: 24,
        avgConversionRate: '3.8%',
        totalRevenue: 125400,
        subscriberCount: 8934,
      },
    }
  },
})
