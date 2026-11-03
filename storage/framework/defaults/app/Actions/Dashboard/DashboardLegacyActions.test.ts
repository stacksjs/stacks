import { describe, expect, it } from 'bun:test'
import { activityStatus } from './DashboardActivityAction'
import { collectDashboardStats, formatDashboardStat } from './DashboardStatsAction'

describe('legacy dashboard API projections', () => {
  it('formats persisted totals without inventing trends', () => {
    expect(formatDashboardStat(
      { title: 'Users', icon: 'users', iconBg: 'primary' },
      { status: 'fulfilled', value: 1234 },
    )).toEqual({
      title: 'Users',
      icon: 'users',
      iconBg: 'primary',
      value: '1,234',
      trend: 0,
      trendLabel: 'Current total',
    })
  })

  it('marks an unavailable model explicitly', () => {
    expect(formatDashboardStat(
      { title: 'Orders', icon: 'orders', iconBg: 'success' },
      { status: 'rejected', reason: new Error('missing table') },
    ).value).toBe('Unavailable')
  })

  it('settles a count that throws before returning a promise as that card\'s failure', async () => {
    // A query on a model whose feature is off throws on first touch, which is
    // what took /api/dashboard/stats down with commerce off.
    const { shown, results } = await collectDashboardStats([
      { title: 'Users', icon: 'users', iconBg: 'primary', count: async () => 3 },
      { title: 'Orders', icon: 'orders', iconBg: 'success', count: () => { throw new Error('commerce is off') } },
    ])
    expect(shown.map(card => card.title)).toEqual(['Users', 'Orders'])
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected'])
  })

  it('leaves out a card whose model is not available', async () => {
    const { shown } = await collectDashboardStats([
      { title: 'Users', icon: 'users', iconBg: 'primary', count: async () => 3 },
      { title: 'Customers', icon: 'customers', iconBg: 'warning', count: async () => 1, available: () => false },
    ])
    expect(shown.map(card => card.title)).toEqual(['Users'])
  })

  it('derives activity severity from persisted event types', () => {
    expect(activityStatus('order.completed')).toBe('success')
    expect(activityStatus('login.failed')).toBe('warning')
    expect(activityStatus('product.deleted')).toBe('warning')
  })
})
