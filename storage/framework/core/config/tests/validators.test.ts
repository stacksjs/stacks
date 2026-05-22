import { describe, expect, test } from 'bun:test'
import { reportConfigIssues, validateConfig } from '../src/validators'

describe('validateConfig (stacksjs/stacks#1874 F-6)', () => {
  test('returns empty array for a clean config', () => {
    const issues = validateConfig({
      app: { name: 'Stacks', env: 'production', debug: false, url: 'https://example.com' },
      ports: { frontend: 3000, api: 3001 },
      database: { default: 'sqlite' },
    } as any)
    expect(issues).toEqual([])
  })

  test('catches a wrong-type port (non-numeric string)', () => {
    const issues = validateConfig({
      ports: { api: 'three thousand' as any },
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('ports.api')
    expect(issues[0].message).toContain('expected integer')
  })

  test('accepts numeric strings as integers (env-var source)', () => {
    // env.PORT comes through as a string from process.env, so a
    // string like "3000" must pass the integer check.
    const issues = validateConfig({
      ports: { api: '3001' as any, frontend: '3000' as any },
    } as any)
    expect(issues).toEqual([])
  })

  test('rejects numeric strings out of range', () => {
    const issues = validateConfig({
      ports: { api: '99999' as any },
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('expected integer in [1, 65535]')
  })

  test('catches an out-of-range port', () => {
    const issues = validateConfig({
      ports: { api: 99999 },
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('ports.api')
    expect(issues[0].message).toContain('expected integer in [1, 65535]')
  })

  test('catches a typoed database driver', () => {
    const issues = validateConfig({
      database: { default: 'mysq' as any },
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('database.default')
    expect(issues[0].message).toContain('expected one of [sqlite, mysql, postgres, dynamodb]')
  })

  test('catches a wrong-type top-level section', () => {
    const issues = validateConfig({
      ports: 'oops' as any,
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('ports')
    expect(issues[0].message).toContain('expected object')
  })

  test('catches an invalid email driver', () => {
    const issues = validateConfig({
      email: { default: 'postmark' as any }, // removed in #1871 M-7
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('email.default')
  })

  test('catches an invalid logging level', () => {
    const issues = validateConfig({
      logging: { level: 'verbose' as any },
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('logging.level')
  })

  test('catches an invalid queue driver', () => {
    const issues = validateConfig({
      queue: { default: 'sqs' as any }, // listed in env types but removed/loud-failed in #1872 Q-1
    } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('queue.default')
  })

  test('accumulates issues from multiple sections', () => {
    const issues = validateConfig({
      ports: { api: 'bad' as any },
      database: { default: 'mysq' as any },
      logging: { level: 'verbose' as any },
    } as any)
    expect(issues).toHaveLength(3)
    expect(issues.map(i => i.path).sort()).toEqual(['database.default', 'logging.level', 'ports.api'])
  })

  test('allows unset fields (null) — only flags mistyped values', () => {
    const issues = validateConfig({
      app: { name: 'Stacks' }, // env, debug, url all unset
    } as any)
    expect(issues).toEqual([])
  })
})

describe('reportConfigIssues', () => {
  test('returns true on a clean config', () => {
    expect(reportConfigIssues({ app: { name: 'X' } } as any)).toBe(true)
  })

  test('returns false when issues are detected', () => {
    // (it also console.warns, but we don't capture that here)
    expect(reportConfigIssues({ ports: { api: 'bad' as any } } as any)).toBe(false)
  })
})
