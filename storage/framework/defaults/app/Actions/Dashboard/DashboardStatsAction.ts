import { Action } from '@stacksjs/actions'
import { Customer, Order, Post, User } from '@stacksjs/orm'

interface DashboardStatDefinition {
  title: string
  icon: string
  iconBg: string
  count: () => Promise<number>
}

export function formatDashboardStat(
  definition: Omit<DashboardStatDefinition, 'count'>,
  result: PromiseSettledResult<number>,
) {
  return {
    ...definition,
    value: result.status === 'fulfilled' ? result.value.toLocaleString() : 'Unavailable',
    trend: 0,
    trendLabel: result.status === 'fulfilled' ? 'Current total' : 'Model unavailable',
  }
}

export default new Action({
  name: 'Dashboard Stats',
  description: 'Fetch persisted dashboard statistics for overview cards',
  method: 'GET',

  async handle() {
    const definitions: DashboardStatDefinition[] = [
      {
        title: 'Total Users',
        icon: 'i-hugeicons-user-group',
        iconBg: 'primary',
        count: () => User.count(),
      },
      {
        title: 'Active Orders',
        icon: 'i-hugeicons-shopping-cart-02',
        iconBg: 'success',
        count: () => Order.where('status', '!=', 'cancelled').count(),
      },
      {
        title: 'Blog Posts',
        icon: 'i-hugeicons-document-validation',
        iconBg: 'info',
        count: () => Post.count(),
      },
      {
        title: 'Customers',
        icon: 'i-hugeicons-user-multiple',
        iconBg: 'warning',
        count: () => Customer.count(),
      },
    ]

    const results = await Promise.allSettled(definitions.map(definition => definition.count()))
    const stats = definitions.map((definition, index) => {
      const { count: _count, ...metadata } = definition
      return formatDashboardStat(metadata, results[index])
    })
    const issues = results.flatMap((result, index) => result.status === 'rejected'
      ? [{
          source: definitions[index].title,
          message: result.reason instanceof Error ? result.reason.message : 'Model query failed.',
        }]
      : [])

    return { stats, issues }
  },
})
