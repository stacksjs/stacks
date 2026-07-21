import { describe, expect, it } from 'bun:test'
import { summarizeHttpRequests } from './DashboardHomeAction'

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
    expect(summarizeHttpRequests(0, []).map(metric => metric.value)).toEqual(['0', '0ms', '100%', '0%'])
  })
})
