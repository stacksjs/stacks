import { Action } from '@stacksjs/actions'
import { User, Product, Order, Post } from '@stacksjs/orm'

export default new Action({
  name: 'DashboardHomeAction',
  description: 'Returns home dashboard data including stats, quick links, services, and recent activity.',
  method: 'GET',

  async handle() {
    const userCount = await User.count()
    const productCount = await Product.count()
    const orderCount = await Order.count()
    const postCount = await Post.count()
    const recentOrders = await Order.orderBy('created_at', 'desc').limit(5).get()
    const recentUsers = await User.orderBy('created_at', 'desc').limit(3).get()

    const stats = [
      { label: 'Total Users', value: String(userCount), trend: '', up: true, color: 'blue' },
      { label: 'Products', value: String(productCount), trend: '', up: true, color: 'green' },
      { label: 'Revenue', value: '-', trend: '', up: true, color: 'orange' },
      { label: 'Orders', value: String(orderCount), trend: '', up: true, color: 'red' },
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

    const activities = [
      ...recentOrders.map(o => ({
        type: 'order',
        message: `Order created`,
        time: 'Recently',
        user: 'Commerce',
      })),
      ...recentUsers.map(u => ({
        type: 'user',
        message: `User registered`,
        time: 'Recently',
        user: 'System',
      })),
    ].slice(0, 5)

    return { stats, quickLinks, services, activities }
  },
})
