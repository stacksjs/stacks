import { Action } from '@stacksjs/actions'
import { orders, payments } from '@stacksjs/commerce'

interface ComparisonShape {
  is_increase: boolean
  percentage: number
}

function formatChange(comparison?: ComparisonShape): string {
  if (!comparison) return ''
  const sign = comparison.is_increase ? '+' : '-'
  return `${sign}${Number(comparison.percentage).toFixed(1)}%`
}

function formatUSD(amount: number): string {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default new Action({
  name: 'CommerceDashboard',
  description: 'Returns commerce dashboard stats, recent orders, and top products for the last 30 days.',
  method: 'GET',
  async handle() {
    try {
      const [paymentStats, orderStats] = await Promise.all([
        payments.fetchPaymentStats(30),
        orders.fetchStats(),
      ])

      // KPI tiles. The first three are real aggregates with period-over-period
      // change. Conversion rate is intentionally a placeholder until we wire a
      // session-tracking source — see TODO at the bottom of this file.
      const stats = [
        {
          label: 'Revenue (30d)',
          value: formatUSD(paymentStats.total_revenue),
          change: formatChange(paymentStats.comparison?.revenue),
        },
        {
          label: 'Orders',
          value: String(orderStats.total),
          change: formatChange(paymentStats.comparison?.transactions),
        },
        {
          label: 'Avg Order Value',
          value: formatUSD(paymentStats.average_transaction),
          change: formatChange(paymentStats.comparison?.average),
        },
        // Conversion rate stays canned — we don't track sessions yet,
        // so we cannot compute orders / sessions. See TODO below.
        { label: 'Conversion Rate', value: '—', change: '' },
      ]

      const recentOrders = (orderStats.recent ?? []).slice(0, 5).map((o: any) => ({
        id: `ORD-${String(o.id).padStart(4, '0')}`,
        customer: o.customer_id ? `#${o.customer_id}` : '—',
        total: formatUSD(Number(o.total_amount) || 0),
        status: String(o.status || 'pending'),
        time: formatRelativeTime(o.created_at),
      }))

      // TODO: top products needs an order_items × products aggregation
      // (sum of quantity grouped by product, ordered desc, top N). The
      // existing `Product.orderByDesc('price')` was wrong — that returns
      // most-expensive products, not best sellers. Until that helper is
      // written, return an empty list rather than misleading data.
      const topProducts: Array<{ name: string, sales: number, revenue: string }> = []

      return { stats, recentOrders, topProducts }
    }
    catch {
      return {
        stats: [
          { label: 'Revenue (30d)', value: '$0.00', change: '' },
          { label: 'Orders', value: '0', change: '' },
          { label: 'Avg Order Value', value: '$0.00', change: '' },
          { label: 'Conversion Rate', value: '—', change: '' },
        ],
        recentOrders: [],
        topProducts: [],
      }
    }
  },
})
