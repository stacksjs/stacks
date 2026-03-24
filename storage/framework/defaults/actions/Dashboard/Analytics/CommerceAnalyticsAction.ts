import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CommerceAnalyticsAction',
  description: 'Returns commerce analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      overview: {
        totalRevenue: 125400,
        totalOrders: 1876,
        avgOrderValue: 66.84,
        conversionRate: '3.2%',
      },
      revenueByDay: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 5000) + 2000,
        orders: Math.floor(Math.random() * 50) + 20,
      })),
      topProducts: [
        { name: 'Premium Plan', revenue: 45600, orders: 456 },
        { name: 'Pro Plan', revenue: 32100, orders: 534 },
        { name: 'Starter Kit', revenue: 18900, orders: 378 },
      ],
    }
  },
})
