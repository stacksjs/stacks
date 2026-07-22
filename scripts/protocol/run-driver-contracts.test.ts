import { describe, expect, it } from 'bun:test'
import type { CapabilityDriver } from '../../storage/framework/core/config/src/capabilities'
import { planDriverContracts } from './run-driver-contracts'

describe('driver contract matrix planning', () => {
  it('runs only supported evidence and reports all other maturity states explicitly', () => {
    const drivers: CapabilityDriver[] = [
      { category: 'cache', name: 'memory', status: 'supported', implementation: 'memory.ts', testEvidence: ['memory.test.ts'], topology: 'memory', prerequisites: [], limitations: [] },
      { category: 'cache', name: 'redis', status: 'partial', implementation: 'redis.ts', testEvidence: ['redis.test.ts'], topology: 'redis', prerequisites: ['Redis'], limitations: ['No live evidence'] },
      { category: 'queue', name: 'sqs', status: 'unsupported', implementation: null, testEvidence: [], topology: 'sqs', prerequisites: ['AWS'], limitations: ['Reserved'] },
    ]
    const plan = planDriverContracts(drivers)
    expect(plan.tests).toEqual(['memory.test.ts'])
    expect(plan.records.map(record => [record.name, record.execution])).toEqual([
      ['memory', 'run'],
      ['redis', 'not-run'],
      ['sqs', 'not-run'],
    ])
    expect(plan.records[1].reason).toContain('partial')
  })
})
