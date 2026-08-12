import { describe, expect, it } from 'bun:test'
import { parseSchedulerRegistry, SchedulerOperationError } from './scheduler-operations'

describe('scheduler operations', () => {
  it('parses the Buddy scheduler registry marker', () => {
    const tasks = parseSchedulerRegistry([
      'loading application',
      'STACKS_SCHEDULE_JSON={"jobs":[{"name":"Cleanup","pattern":"0 * * * *","timezone":"UTC","nextRun":"2026-08-12T12:00:00.000Z","enabled":false}],"locks":[]}',
    ].join('\n'))

    expect(tasks).toEqual([{
      name: 'Cleanup',
      pattern: '0 * * * *',
      timezone: 'UTC',
      nextRun: '2026-08-12T12:00:00.000Z',
      enabled: false,
    }])
  })

  it('rejects unmarked output instead of guessing', () => {
    expect(() => parseSchedulerRegistry('{"jobs":[]}')).toThrow(SchedulerOperationError)
  })
})
