import { Action } from '@stacksjs/actions/runtime'
import { Customer, Order, Post, User } from '@stacksjs/orm'
import { dashboardOperationalIssue } from './dashboard-response'

interface DashboardStatDefinition {
  title: string
  icon: string
  iconBg: string
  count: () => number | Promise<number>
  /** False when the model's feature is off, so the card is left out. */
  available?: () => boolean
}

/** A model whose feature is off answers `getDefinition` with nothing. */
function loaded(model: unknown): boolean {
  return Boolean((model as { getDefinition?: () => unknown } | undefined)?.getDefinition?.())
}

/**
 * Settle every available card's count, each on its own.
 *
 * A count runs inside a promise, so one that throws before it returns one -
 * a query on a model whose feature is off throws the moment it is touched -
 * becomes that card's failure, not the request's. It used to be called
 * straight from a map, so with commerce off (the default since #2488) the
 * first Order card threw out of the action and the whole endpoint answered
 * 500.
 */
export async function collectDashboardStats(definitions: DashboardStatDefinition[]) {
  const shown = definitions.filter(definition => definition.available?.() ?? true)
  const results = await Promise.allSettled(shown.map(definition => Promise.resolve().then(definition.count)))
  return { shown, results }
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
        available: () => loaded(Order),
      },
      {
        title: 'Blog Posts',
        icon: 'i-hugeicons-document-validation',
        iconBg: 'info',
        count: () => Post.count(),
        available: () => loaded(Post),
      },
      {
        title: 'Customers',
        icon: 'i-hugeicons-user-multiple',
        iconBg: 'warning',
        count: () => Customer.count(),
        available: () => loaded(Customer),
      },
    ]

    const { shown, results } = await collectDashboardStats(definitions)
    const stats = shown.map((definition, index) => {
      const { count: _count, available: _available, ...metadata } = definition
      // allSettled returns one result per input, but indexed access is typed
      // as possibly missing; a rejected placeholder keeps the shape honest.
      const result = results[index] ?? { status: 'rejected' as const, reason: new Error('missing result') }
      return formatDashboardStat(metadata, result)
    })
    const issues = results.flatMap((result, index) => result.status === 'rejected'
      ? [{
          source: shown[index]?.title ?? 'Unknown',
          message: dashboardOperationalIssue(
            result.reason,
            `${shown[index]?.title ?? 'Dashboard'} data could not be loaded.`,
            `DashboardStatsAction.${(shown[index]?.title ?? 'unknown').toLowerCase().replaceAll(' ', '-')}`,
          ),
        }]
      : [])

    return { stats, issues }
  },
})
