import { describe, expect, it } from 'bun:test'
import {
  averageRecordedDuration,
  booleanValue,
  deploymentCommandArgs,
  deploymentPreviewCommandArgs,
  tailLines,
} from './deployment-input'

function record(duration: unknown) {
  return {
    get(key: string) {
      return key === 'duration' ? duration : undefined
    },
  }
}

describe('dashboard deployment inputs', () => {
  it('builds a non-interactive buddy command from validated arguments', () => {
    expect(deploymentCommandArgs({
      environment: 'staging',
      domain: 'app.example.com',
    })).toEqual([
      'deploy',
      '--env',
      'staging',
      '--no-interaction',
      '--yes',
      '--domain',
      'app.example.com',
    ])
  })

  it('rejects invalid command fields', () => {
    expect(() => deploymentCommandArgs({ environment: '../production' })).toThrow()
    expect(() => deploymentCommandArgs({ domain: 'not a domain' })).toThrow()
  })

  it('builds a non-mutating machine-readable preview command', () => {
    expect(deploymentPreviewCommandArgs({ environment: 'staging' })).toEqual([
      'deploy',
      '--env',
      'staging',
      '--dry-run',
      '--json',
      '--no-interaction',
    ])
  })

  it('aggregates only recorded durations', () => {
    expect(averageRecordedDuration([record(30), record('90'), record(null), record('bad')])).toBe(60)
    expect(averageRecordedDuration([record('bad')])).toBeNull()
  })

  it('normalizes booleans and tails persisted output', () => {
    expect(booleanValue('on')).toBe(true)
    expect(booleanValue('false')).toBe(false)
    expect(tailLines('one\ntwo\nthree', 2)).toBe('two\nthree')
  })
})
