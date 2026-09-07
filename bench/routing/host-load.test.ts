import { describe, expect, test } from 'bun:test'
import { formatBusyProcess, parseProcessCpu } from './host-load'

describe('benchmark host load preflight', () => {
  test('finds busy processes, sorts them, and excludes the runner', () => {
    expect(parseProcessCpu(`
      10  12.5 quiet
      20  88.4 compiler
      30 101.2 worker
      40  99.0 runner
      malformed
    `, 40)).toEqual([
      { pid: 30, cpuPercent: 101.2, command: 'worker' },
      { pid: 20, cpuPercent: 88.4, command: 'compiler' },
    ])
  })

  test('formats enough detail to identify the process', () => {
    expect(formatBusyProcess({ pid: 20, cpuPercent: 88.44, command: 'compiler' }))
      .toBe('compiler (PID 20, 88.4% CPU)')
  })

  test('rejects smaller processes that consume a core in aggregate', () => {
    expect(parseProcessCpu(`
      10  40.0 renderer
      20  25.0 compiler
      30  12.0 worker
      40   8.0 background
    `)).toEqual([
      { pid: 10, cpuPercent: 40, command: 'renderer' },
      { pid: 20, cpuPercent: 25, command: 'compiler' },
      { pid: 30, cpuPercent: 12, command: 'worker' },
    ])
  })

  test('accepts combined background load below the threshold', () => {
    expect(parseProcessCpu(`
      10  40.0 renderer
      20  25.0 compiler
      30   9.9 worker
    `)).toEqual([])
  })
})
