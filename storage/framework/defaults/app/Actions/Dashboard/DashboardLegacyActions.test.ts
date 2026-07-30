import { describe, expect, it } from 'bun:test'
import { activityStatus } from './DashboardActivityAction'
import { formatDashboardStat } from './DashboardStatsAction'

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

  it('derives activity severity from persisted event types', () => {
    expect(activityStatus('order.completed')).toBe('success')
    expect(activityStatus('login.failed')).toBe('warning')
    expect(activityStatus('product.deleted')).toBe('warning')
  })
})
