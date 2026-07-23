import { describe, expect, it } from 'bun:test'
import { buildReport, executeConfigEvidence, executeConventionsEvidence, executeSecurityEvidence, executeValidationEvidence } from './run-conformance'

const REVISION = '0'.repeat(40)

describe('protocol adapter evidence', () => {
  it('executes authenticated encryption, timing-safe comparison, and default escaping checks', () => {
    const evidence = executeSecurityEvidence(REVISION)
    expect(evidence.get('CORE-SEC-05')?.status).toBe('pass')
    expect(evidence.get('CORE-SEC-07')?.status).toBe('pass')
    expect(evidence.get('CORE-SEC-02')?.status).toBe('pass')
  })

  it('rejects an unavailable capability driver before any work begins', () => {
    const evidence = executeConfigEvidence(REVISION)
    expect(evidence.get('CORE-CONFIG-02')?.status).toBe('pass')
  })

  it('produces field-keyed validation errors and a redacted 422 envelope', async () => {
    const evidence = await executeValidationEvidence(REVISION)
    expect(evidence.get('CORE-VAL-01')?.status).toBe('pass')
    expect(evidence.get('CORE-ERR-01')?.status).toBe('pass')
    expect(evidence.get('CORE-ERR-02')?.status).toBe('pass')
  })

  it('maps canonical roles to paths and prefers app-owned overrides', () => {
    const evidence = executeConventionsEvidence(REVISION)
    expect(evidence.get('CORE-CONV-01')?.status).toBe('pass')
    expect(evidence.get('CORE-CONV-02')?.status).toBe('pass')
  })

  it('reports each registered driver independently', async () => {
    const report = await buildReport() as { drivers: Array<{ category: string, name: string }> }
    expect(report.drivers.length).toBeGreaterThan(7)
    expect(report.drivers).toContainEqual(expect.objectContaining({ category: 'database', name: 'sqlite' }))
    expect(report.drivers).toContainEqual(expect.objectContaining({ category: 'queue', name: 'sqs' }))
  })

  it('marks every passing requirement with a source evidence url', async () => {
    const report = await buildReport() as { results: Array<{ status: string, evidenceUrl: string | null }> }
    const passing = report.results.filter(result => result.status === 'pass')
    expect(passing.length).toBeGreaterThanOrEqual(9)
    expect(passing.every(result => typeof result.evidenceUrl === 'string' && result.evidenceUrl.startsWith('https://'))).toBe(true)
  })
})
