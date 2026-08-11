import { describe, expect, it } from 'bun:test'
import { orderActivityStatus, serializeHealthCheck, summarizeHttpRequests } from './DashboardHomeAction'

describe('dashboard HTTP metrics', () => {
  it('summarizes captured requests without fake values', () => {
    const metrics = summarizeHttpRequests(12_345, [
      { duration: 10, status: 200 },
      { duration: 20, status: 302 },
      { duration: 30, status: 404 },
      { duration: 40, status: 500 },
    ])

    expect(metrics.map(metric => metric.value)).toEqual(['12,345', '25ms', '50.0%', '50.0%'])
  })

  it('returns explicit empty-state metrics', () => {
    expect(summarizeHttpRequests(0, []).map(metric => metric.value)).toEqual(['0', '0ms', 'N/A', 'N/A'])
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
