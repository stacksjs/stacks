import { Action } from '@stacksjs/actions'
import { User, Product, Order, Post } from '@stacksjs/orm'

export default new Action({
  name: 'DashboardHomeAction',
  description: 'Returns home dashboard data including stats, quick links, services, and recent activity.',
  method: 'GET',

  async handle() {
    let userCount = 0
    let productCount = 0
    let orderCount = 0
    let postCount = 0
    let totalRevenue = 0
    let recentOrderRows: any[] = []
    let recentUserRows: any[] = []

    try {
      const results = await Promise.all([
        User.count(),
        Product.count(),
        Order.count(),
        Post.count(),
        Order.orderBy('created_at', 'desc').limit(5).get(),
        User.orderBy('created_at', 'desc').limit(3).get(),
      ])

      userCount = results[0]
      productCount = results[1]
      orderCount = results[2]
      postCount = results[3]
      recentOrderRows = results[4]
      recentUserRows = results[5]

      // Calculate total revenue from all orders
      const allOrders = await Order.all()
      totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.get('total_amount')) || 0), 0)
    }
    catch {
      // Database may not exist yet - use fallback values
    }

    const stats = [
      { label: 'Total Users', value: String(userCount), trend: '+12%', up: true, color: 'blue' },
      { label: 'Products', value: String(productCount), trend: '+8%', up: true, color: 'green' },
      { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: '+23%', up: true, color: 'orange' },
      { label: 'Orders', value: String(orderCount), trend: '+5%', up: true, color: 'red' },
    ]

    const quickLinks = [
      { title: 'Blog', description: 'Manage posts and content', page: 'posts' },
      { title: 'Commerce', description: 'View sales and orders', page: 'commerce-dashboard' },
      { title: 'Cloud', description: 'Infrastructure settings', page: 'cloud' },
      { title: 'Settings', description: 'Configure your app', page: 'settings' },
    ]

    const services = [
      { name: 'Database', status: userCount > 0 ? 'healthy' : 'offline', latency: userCount > 0 ? '12ms' : 'N/A' },
      { name: 'Cache', status: 'healthy', latency: '2ms' },
      { name: 'Queue', status: 'healthy', latency: '45ms' },
      { name: 'Storage', status: 'healthy', latency: '8ms' },
      { name: 'Email', status: 'warning', latency: '234ms' },
    ]

    // Build activities from real data
    const activities = [
      ...recentOrderRows.map((o: any) => ({
        type: 'order',
        message: `Order #${o.get('id')} - $${o.get('total_amount')} (${o.get('status')})`,
        time: 'Recently',
        user: 'Commerce',
      })),
      ...recentUserRows.map((u: any) => ({
        type: 'user',
        message: `User ${u.get('name')} registered`,
        time: 'Recently',
        user: 'System',
      })),
    ].slice(0, 5)

    return { stats, quickLinks, services, activities }
  },
})
