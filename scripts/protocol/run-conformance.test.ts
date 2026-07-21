import { describe, expect, it } from 'bun:test'
import { executeSecurityEvidence } from './run-conformance'

describe('protocol adapter evidence', () => {
  it('executes authenticated encryption and timing-safe comparison checks', () => {
    const evidence = executeSecurityEvidence('0'.repeat(40))
    expect(evidence.get('CORE-SEC-05')?.status).toBe('pass')
    expect(evidence.get('CORE-SEC-07')?.status).toBe('pass')
  })
})
