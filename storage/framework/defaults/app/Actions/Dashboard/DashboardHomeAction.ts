import { Action } from '@stacksjs/actions/runtime'
import { feature } from '@stacksjs/config'
import { Order, Product, Request, User } from '@stacksjs/orm'
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

/**
 * Run each query inside the promise, so one that throws before returning one -
 * `Product.count()` when commerce is off, where the model is not loaded and
 * `count` is undefined - is a rejected entry rather than a 500 for the page.
 * `Promise.allSettled([Product.count(), ...])` evaluated every call first.
 */
export function settleEach<T extends readonly (() => unknown)[]>(queries: T): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<ReturnType<T[K]>>> }> {
  return Promise.allSettled(queries.map(query => Promise.resolve().then(query))) as never
}

type Settled = PromiseSettledResult<unknown>

/**
 * The headline numbers. Products, revenue and orders are commerce's, so with
 * commerce off they are left out rather than shown as "Unavailable" - there is
 * nothing to be unavailable.
 */
export function homeStats(
  results: { users: Settled, products?: Settled, revenue?: Settled, orders?: Settled },
  commerce: boolean,
): Array<{ label: string, value: string, color: string }> {
  const value = (result: Settled | undefined, format: (raw: unknown) => string) =>
    result?.status === 'fulfilled' ? format(result.value) : 'Unavailable'

  const stats = [{ label: 'Total Users', value: value(results.users, String), color: 'blue' }]
  if (commerce) {
    stats.push(
      { label: 'Products', value: value(results.products, String), color: 'green' },
      { label: 'Revenue', value: value(results.revenue, raw => `$${Number(raw || 0).toLocaleString()}`), color: 'orange' },
      { label: 'Orders', value: value(results.orders, String), color: 'red' },
    )
  }
  return stats
}

export default new Action({
  name: 'DashboardHomeAction',
  description: 'Returns home dashboard data including stats, quick links, services, and recent activity.',
  method: 'GET',

  async handle() {
    const commerce = feature('commerce')
    const none = async () => null
    const [
      userCount,
      productCount,
      orderCount,
      totalRevenue,
      recentOrders,
      recentUsers,
      requestCount,
      recentRequests,
    ] = await settleEach([
      () => User.count(),
      commerce ? () => Product.count() : none,
      commerce ? () => Order.count() : none,
      commerce ? () => Order.sum('totalAmount') : none,
      commerce ? () => Order.orderBy('created_at', 'desc').limit(5).get() : async () => [],
      () => User.orderBy('created_at', 'desc').limit(5).get(),
      () => Request.count(),
      () => Request.orderBy('created_at', 'desc').limit(1000).get(),
    ] as const)
    const healthResult = await Promise.allSettled([checkApplicationHealth()])

    const stats = homeStats({ users: userCount, products: productCount, revenue: totalRevenue, orders: orderCount }, commerce)

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

    const sources: Array<[string, PromiseSettledResult<unknown>]> = [
      ['Users', userCount],
      ['Products', productCount],
      ['Orders', orderCount],
      ['Revenue', totalRevenue],
      ['Recent orders', recentOrders],
      ['Recent users', recentUsers],
      ['Request count', requestCount],
      ['Recent requests', recentRequests],
    ]
    const issues = sources
      .map(([source, result]) => issue(source, result))
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
