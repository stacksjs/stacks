import { Action } from '@stacksjs/actions'
import { Order, Post, Product, Request, User } from '@stacksjs/orm'
import { checkApplicationHealth, type ApplicationHealthCheck } from '@stacksjs/router'
import { formatRelative, safeGet } from '../../../resources/functions/dashboard/data'
import { dashboardOperationalIssue } from './dashboard-response'

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
    { title: 'Success Rate', value: requests.length > 0 ? `${((successful / requests.length) * 100).toFixed(1)}%` : 'N/A', detail: '2xx and 3xx responses', icon: 'i-hugeicons-checkmark-circle-02' },
    { title: 'Error Rate', value: requests.length > 0 ? `${((failed / requests.length) * 100).toFixed(1)}%` : 'N/A', detail: '4xx and 5xx responses', icon: 'i-hugeicons-alert-02' },
  ]
}

export function serializeHealthCheck(name: string, check: ApplicationHealthCheck) {
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    status: check.ok ? 'healthy' : 'critical',
    latency: `${check.ms}ms`,
    detail: check.ok ? '' : 'Dependency probe failed.',
  }
}

export function orderActivityStatus(status: unknown): 'success' | 'warning' {
  const normalized = String(status || '').toLowerCase()
  return normalized.startsWith('cancel') || normalized === 'failed' || normalized === 'refunded'
    ? 'warning'
    : 'success'
}

function issue(source: string, result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected'
    ? {
        source,
        message: dashboardOperationalIssue(
          result.reason,
          `${source} data could not be loaded.`,
          `DashboardHomeAction.${source.toLowerCase().replaceAll(' ', '-')}`,
        ),
      }
    : null
}

export default new Action({
  name: 'DashboardHomeAction',
  description: 'Returns home dashboard data including stats, quick links, services, and recent activity.',
  method: 'GET',

  async handle() {
    const modelResults = await Promise.allSettled([
      User.count(),
      Product.count(),
      Order.count(),
      Post.count(),
      Order.sum('totalAmount'),
      Order.orderBy('created_at', 'desc').limit(5).get(),
      User.orderBy('created_at', 'desc').limit(5).get(),
      Request.count(),
      Request.orderBy('created_at', 'desc').limit(1000).get(),
    ])
    const healthResult = await Promise.allSettled([checkApplicationHealth()])

    const [
      userCount,
      productCount,
      orderCount,
      postCount,
      totalRevenue,
      recentOrders,
      recentUsers,
      requestCount,
      recentRequests,
    ] = modelResults

    const stats = [
      { label: 'Total Users', value: userCount.status === 'fulfilled' ? String(userCount.value) : 'Unavailable', color: 'blue' },
      { label: 'Products', value: productCount.status === 'fulfilled' ? String(productCount.value) : 'Unavailable', color: 'green' },
      { label: 'Revenue', value: totalRevenue.status === 'fulfilled' ? `$${Number(totalRevenue.value || 0).toLocaleString()}` : 'Unavailable', color: 'orange' },
      { label: 'Orders', value: orderCount.status === 'fulfilled' ? String(orderCount.value) : 'Unavailable', color: 'red' },
    ]

    const httpMetrics = requestCount.status === 'fulfilled' && recentRequests.status === 'fulfilled'
      ? summarizeHttpRequests(requestCount.value, recentRequests.value.map(request => ({
        duration: Number(request.get('duration_ms')) || 0,
        status: Number(request.get('status_code')) || 500,
      })))
      : summarizeHttpRequests(0, [])

    const health = healthResult[0]
    const services = health.status === 'fulfilled'
      ? Object.entries(health.value.checks).map(([name, check]) => {
          if (!check.ok) {
            dashboardOperationalIssue(
              check.message,
              'Dependency probe failed.',
              `DashboardHomeAction.health.${name}`,
            )
          }
          return serializeHealthCheck(name, check)
        })
      : []

    const activities = [
      ...(recentOrders.status === 'fulfilled' ? recentOrders.value : []).map((order: any) => ({
        type: 'order',
        message: `Order #${order.get('id')} - $${order.get('total_amount')} (${order.get('status')})`,
        time: formatRelative(safeGet(order, 'created_at')),
        timestamp: String(safeGet(order, 'created_at', '')),
        user: 'Commerce',
        status: orderActivityStatus(order.get('status')),
      })),
      ...(recentUsers.status === 'fulfilled' ? recentUsers.value : []).map((user: any) => ({
        type: 'user',
        message: `User ${user.get('name') || `#${user.get('id')}`} registered`,
        time: formatRelative(safeGet(user, 'created_at')),
        timestamp: String(safeGet(user, 'created_at', '')),
        user: 'System',
        status: 'success',
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map(activity => ({
        type: activity.type,
        message: activity.message,
        time: activity.time,
        user: activity.user,
        status: activity.status,
      }))

    const sources = ['Users', 'Products', 'Orders', 'Posts', 'Revenue', 'Recent orders', 'Recent users', 'Request count', 'Recent requests']
    const issues = modelResults
      .map((result, index) => issue(sources[index], result))
      .filter((entry): entry is { source: string, message: string } => entry !== null)
    if (health.status === 'rejected') {
      issues.push({
        source: 'System health',
        message: dashboardOperationalIssue(
          health.reason,
          'System health could not be loaded.',
          'DashboardHomeAction.health',
        ),
      })
    }

    return { stats, httpMetrics, services, activities, issues }
  },
})
