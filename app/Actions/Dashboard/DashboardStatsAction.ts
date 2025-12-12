import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { Customer, Order, Post, User } from '@stacksjs/orm'

export default new Action({
  name: 'Dashboard Stats',
  description: 'Fetch dashboard statistics for overview cards',
  method: 'GET',

  async handle(request: any) {
    const range = request?.getParam('range') || '7d'

    // Calculate date range
    const now = new Date()
    const rangeMap: Record<string, number> = {
      today: 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      all: 3650,
    }
    const days = rangeMap[range] || 7
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000)

    // Fetch current period stats
    const [
      totalUsers,
      previousUsers,
      totalOrders,
      previousOrders,
      totalPosts,
      previousPosts,
      totalCustomers,
      previousCustomers,
    ] = await Promise.all([
      User.where('created_at', '>=', startDate.toISOString()).count(),
      User.where('created_at', '>=', previousStartDate.toISOString())
        .where('created_at', '<', startDate.toISOString())
        .count(),
      Order.where('created_at', '>=', startDate.toISOString()).count(),
      Order.where('created_at', '>=', previousStartDate.toISOString())
        .where('created_at', '<', startDate.toISOString())
        .count(),
      Post.where('created_at', '>=', startDate.toISOString()).count(),
      Post.where('created_at', '>=', previousStartDate.toISOString())
        .where('created_at', '<', startDate.toISOString())
        .count(),
      Customer.where('created_at', '>=', startDate.toISOString()).count(),
      Customer.where('created_at', '>=', previousStartDate.toISOString())
        .where('created_at', '<', startDate.toISOString())
        .count(),
    ])

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const stats = [
      {
        title: 'Total Users',
        value: totalUsers.toLocaleString(),
        trend: calculateTrend(totalUsers, previousUsers),
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-user-group',
        iconBg: 'primary',
      },
      {
        title: 'Active Orders',
        value: totalOrders.toLocaleString(),
        trend: calculateTrend(totalOrders, previousOrders),
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-shopping-cart-02',
        iconBg: 'success',
      },
      {
        title: 'Blog Posts',
        value: totalPosts.toLocaleString(),
        trend: calculateTrend(totalPosts, previousPosts),
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-document-validation',
        iconBg: 'info',
      },
      {
        title: 'Customers',
        value: totalCustomers.toLocaleString(),
        trend: calculateTrend(totalCustomers, previousCustomers),
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-user-multiple',
        iconBg: 'warning',
      },
    ]

    return response.json({ stats })
  },
})
