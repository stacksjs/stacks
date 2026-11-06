import { describe, expect, it } from 'bun:test'
import { homeStats, orderActivityStatus, serializeHealthCheck, settleEach, summarizeHttpRequests } from './DashboardHomeAction'

describe('dashboard HTTP metrics', () => {
  it('summarizes every captured request, as the database counted them', () => {
    const metrics = summarizeHttpRequests({ total: 12_345, successful: 9_876, failed: 2_469, averageDuration: 24.6 })

    expect(metrics.map(metric => metric.value)).toEqual(['12,345', '25ms', '80.0%', '20.0%'])
  })

  it('takes the rates over all requests, not a sample, and says so', () => {
    // A request with no recorded status is neither a success nor a failure,
    // so the two rates need not add up to 100%.
    const metrics = summarizeHttpRequests({ total: 4, successful: 2, failed: 1, averageDuration: 10 })

    expect(metrics.map(metric => metric.value)).toEqual(['4', '10ms', '50.0%', '25.0%'])
    expect(metrics[1]?.detail).toBe('All captured requests')
  })

  it('returns explicit empty-state metrics', () => {
    expect(summarizeHttpRequests({ total: 0, successful: 0, failed: 0, averageDuration: 0 }).map(metric => metric.value)).toEqual(['0', '0ms', 'N/A', 'N/A'])
  })

  it('serializes only probed service health', () => {
    expect(serializeHealthCheck('database', { ok: true, ms: 3 })).toEqual({
      name: 'Database',
      status: 'healthy',
      latency: '3ms',
      detail: '',
    })
    expect(serializeHealthCheck('cache', { ok: false, ms: 1500, message: 'timeout' })).toEqual({
      name: 'Cache',
      status: 'critical',
      latency: '1500ms',
      detail: 'Dependency probe failed.',
    })
  })

  it('marks unsuccessful order states as warnings', () => {
    expect(orderActivityStatus('CANCELED')).toBe('warning')
    expect(orderActivityStatus('cancelled')).toBe('warning')
    expect(orderActivityStatus('failed')).toBe('warning')
    expect(orderActivityStatus('preparing')).toBe('success')
  })
})

describe('dashboard home queries', () => {
  it('turns a query that throws before returning a promise into a rejected entry', async () => {
    // What `Product.count()` does with commerce off: the model is not loaded,
    // `count` is undefined, and calling it throws synchronously. Evaluated as
    // `Promise.allSettled([Product.count(), ...])` that escaped allSettled and
    // returned a 500 for the whole page.
    const unloaded = {} as { count: () => Promise<number> }
    const [users, products] = await settleEach([async () => 3, () => unloaded.count()] as const)

    expect(users).toEqual({ status: 'fulfilled', value: 3 })
    expect(products.status).toBe('rejected')
  })

  it('shows commerce numbers only when commerce is on', () => {
    const users = { status: 'fulfilled', value: 12 } as const
    expect(homeStats({ users }, false)).toEqual([{ label: 'Total Users', value: '12', color: 'blue' }])

    const on = homeStats({
      users,
      products: { status: 'fulfilled', value: 4 },
      revenue: { status: 'fulfilled', value: 1250 },
      orders: { status: 'rejected', reason: new Error('down') },
    }, true)
    expect(on.map(stat => [stat.label, stat.value])).toEqual([
      ['Total Users', '12'],
      ['Products', '4'],
      ['Revenue', '$1,250'],
      ['Orders', 'Unavailable'],
    ])
  })
})
