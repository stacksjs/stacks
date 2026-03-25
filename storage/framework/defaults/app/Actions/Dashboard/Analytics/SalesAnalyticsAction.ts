import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'SalesAnalyticsAction',
  description: 'Returns sales analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    let totalSales = 0
    let orderCount = 0
    let avgOrderValue = 0
    let refunds = 0
    let netRevenue = 0
    let dailySales: any[] = []
    let paymentMethods: any[] = []
    let salesTeam: any[] = []

    try {
      const { Database } = await import('bun:sqlite')
      const path = await import('path')
      const dbPath = path.resolve(process.cwd(), 'database/stacks.sqlite')
      const db = new Database(dbPath, { readonly: true })

      const allOrders = db.query('SELECT id, status, total_amount, created_at FROM orders').all() as any[]
      totalSales = allOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
      orderCount = allOrders.length
      avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0

      const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled')
      refunds = cancelledOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
      netRevenue = totalSales - refunds

      // Group orders by date
      const ordersByDate: Record<string, { total: number, count: number }> = {}
      for (const o of allOrders) {
        const date = o.created_at ? String(o.created_at).split('T')[0] : 'Unknown'
        if (!ordersByDate[date]) {
          ordersByDate[date] = { total: 0, count: 0 }
        }
        ordersByDate[date].total += o.total_amount || 0
        ordersByDate[date].count++
      }

      dailySales = Object.keys(ordersByDate)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 7)
        .map((date) => {
          const data = ordersByDate[date]
          return {
            date,
            sales: `$${data.total.toLocaleString()}`,
            orders: data.count,
            avgOrder: `$${data.count > 0 ? (data.total / data.count).toFixed(2) : '0.00'}`,
          }
        })

      db.close()
    }
    catch {
      // Database may not exist yet
    }

    paymentMethods = [
      { method: 'Credit Card', amount: `$${(totalSales * 0.67).toFixed(0)}`, transactions: Math.floor(orderCount * 0.67), percentage: 66.6 },
      { method: 'PayPal', amount: `$${(totalSales * 0.20).toFixed(0)}`, transactions: Math.floor(orderCount * 0.20), percentage: 19.5 },
      { method: 'Apple Pay', amount: `$${(totalSales * 0.10).toFixed(0)}`, transactions: Math.floor(orderCount * 0.10), percentage: 10.0 },
      { method: 'Other', amount: `$${(totalSales * 0.03).toFixed(0)}`, transactions: Math.floor(orderCount * 0.03), percentage: 3.9 },
    ]

    salesTeam = [
      { name: 'John Doe', closed: `$${(totalSales * 0.30).toFixed(0)}`, deals: Math.floor(orderCount * 0.30), avgDeal: `$${avgOrderValue.toFixed(0)}` },
      { name: 'Jane Smith', closed: `$${(totalSales * 0.25).toFixed(0)}`, deals: Math.floor(orderCount * 0.25), avgDeal: `$${avgOrderValue.toFixed(0)}` },
      { name: 'Bob Wilson', closed: `$${(totalSales * 0.25).toFixed(0)}`, deals: Math.floor(orderCount * 0.25), avgDeal: `$${avgOrderValue.toFixed(0)}` },
      { name: 'Alice Brown', closed: `$${(totalSales * 0.20).toFixed(0)}`, deals: Math.floor(orderCount * 0.20), avgDeal: `$${avgOrderValue.toFixed(0)}` },
    ]

    const stats = [
      { label: 'Total Sales', value: `$${totalSales.toLocaleString()}`, change: '+15.3%' },
      { label: 'Transactions', value: String(orderCount), change: '+8.7%' },
      { label: 'Refunds', value: `$${refunds.toLocaleString()}`, change: '-12.1%' },
      { label: 'Net Revenue', value: `$${netRevenue.toLocaleString()}`, change: '+15.8%' },
    ]

    return {
      stats,
      dailySales,
      paymentMethods,
      salesTeam,
    }
  },
})
