import { Action } from '@stacksjs/actions'
import { Order, Post, Product, Request, User } from '@stacksjs/orm'

interface HttpRequestSample {
  duration: number
  status: number
}

export function summarizeHttpRequests(total: number, requests: HttpRequestSample[]) {
  const successful = requests.filter(request => request.status >= 200 && request.status < 400).length
  const failed = requests.filter(request => request.status >= 400).length
  const averageDuration = requests.length > 0
    ? Math.round(requests.reduce((sum, request) => sum + request.duration, 0) / requests.length)
    : 0

  return [
    { title: 'HTTP Requests', value: total.toLocaleString(), detail: 'All captured requests', icon: 'i-hugeicons-global' },
    { title: 'Average Response', value: `${averageDuration}ms`, detail: `Latest ${requests.length.toLocaleString()} requests`, icon: 'i-hugeicons-clock-01' },
    { title: 'Success Rate', value: requests.length > 0 ? `${((successful / requests.length) * 100).toFixed(1)}%` : '100%', detail: '2xx and 3xx responses', icon: 'i-hugeicons-checkmark-circle-02' },
    { title: 'Error Rate', value: requests.length > 0 ? `${((failed / requests.length) * 100).toFixed(1)}%` : '0%', detail: '4xx and 5xx responses', icon: 'i-hugeicons-alert-02' },
  ]
}

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
    let databaseStatus = 'offline'
    let httpMetrics = summarizeHttpRequests(0, [])

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
      databaseStatus = 'healthy'
    }
    catch {
      // A new project may not have run its migrations yet.
    }

    try {
      const [requestCount, recentRequests] = await Promise.all([
        Request.count(),
        Request.orderBy('created_at', 'desc').limit(1000).get(),
      ])
      httpMetrics = summarizeHttpRequests(requestCount, recentRequests.map(request => ({
        duration: Number(request.get('duration_ms')) || 0,
        status: Number(request.get('status_code')) || 500,
      })))
    }
    catch {
      // Request capture is optional, so its empty state is valid.
    }

    const stats = [
      { label: 'Total Users', value: String(userCount), color: 'blue' },
      { label: 'Products', value: String(productCount), color: 'green' },
      { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'orange' },
      { label: 'Orders', value: String(orderCount), color: 'red' },
    ]

    const quickLinks = [
      { title: 'Blog', description: 'Manage posts and content', page: 'posts' },
      { title: 'Commerce', description: 'View sales and orders', page: 'commerce-dashboard' },
      { title: 'Cloud', description: 'Infrastructure settings', page: 'cloud' },
      { title: 'Settings', description: 'Configure your app', page: 'settings' },
    ]

    const services = [
      { name: 'Database', status: databaseStatus, latency: 'N/A' },
      { name: 'Cache', status: 'configured', latency: 'N/A' },
      { name: 'Queue', status: 'configured', latency: 'N/A' },
      { name: 'Storage', status: 'configured', latency: 'N/A' },
      { name: 'Email', status: 'configured', latency: 'N/A' },
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

    return { stats, httpMetrics, quickLinks, services, activities }
  },
})
