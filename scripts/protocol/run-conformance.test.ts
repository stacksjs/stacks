import { describe, expect, it } from 'bun:test'
import { buildReport, executeSecurityEvidence } from './run-conformance'

describe('protocol adapter evidence', () => {
  it('executes authenticated encryption and timing-safe comparison checks', () => {
    const evidence = executeSecurityEvidence('0'.repeat(40))
    expect(evidence.get('CORE-SEC-05')?.status).toBe('pass')
    expect(evidence.get('CORE-SEC-07')?.status).toBe('pass')
  })

  it('reports each registered driver independently', () => {
    const report = buildReport() as { drivers: Array<{ category: string, name: string }> }
    expect(report.drivers.length).toBeGreaterThan(7)
    expect(report.drivers).toContainEqual(expect.objectContaining({ category: 'database', name: 'sqlite' }))
    expect(report.drivers).toContainEqual(expect.objectContaining({ category: 'queue', name: 'sqs' }))
  })
})
