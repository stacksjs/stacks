import { describe, expect, test } from 'bun:test'
import { busyProcessesFromSamples, formatBusyProcess, parseProcessCpuTimes, parseProcStatCpuTime } from './host-load'

const sample = (entries: Array<[number, number, string]>) =>
  new Map(entries.map(([pid, seconds, command]) => [pid, { seconds, command }]))

describe('benchmark host load preflight', () => {
  test('reads cumulative CPU time from ps, in every format it prints', () => {
    expect(parseProcessCpuTimes(`
      10       0:03.45 quiet
      20    1:02:03 compiler
      30 2-01:00:00 worker
      40      0:00.00 idle
      malformed
    `)).toEqual(sample([
      [10, 3.45, 'quiet'],
      [20, 3723, 'compiler'],
      [30, 176_400, 'worker'],
      [40, 0, 'idle'],
    ]))
  })

  test('reads utime and stime from a proc stat line whose command contains spaces and parentheses', () => {
    // state, ppid, pgrp, session, tty_nr, tpgid, flags, minflt, cminflt,
    // majflt, cmajflt, then utime and stime: 100 + 50 ticks at 100Hz is 1.5s.
    const beforeCpu = ['S', '1', '1', '0', '-1', '4194304', '900', '0', '0', '0', '0']
    expect(parseProcStatCpuTime(`7 (my (odd) name) ${beforeCpu.join(' ')} 100 50 0 0 0`))
      .toEqual({ seconds: 1.5, command: 'my (odd) name' })
  })

  test.each(['', '7 no-parens S 1', '7 (proc) S 1 2 3'])('reports an unreadable stat line as unmeasured: %s', (line) => {
    expect(parseProcStatCpuTime(line)).toBeNull()
  })

  test('measures what a process is using now, not over its lifetime', () => {
    // The case a lifetime average cannot see: a long-lived process that has
    // been idle for hours and is now saturating a core. Its cputime/realtime
    // ratio stays near zero, so `ps -o %cpu` would report it as quiet.
    const before = sample([[10, 6, 'database'], [20, 500, 'ancient']])
    const after = sample([[10, 7, 'database'], [20, 500, 'ancient']])
    expect(busyProcessesFromSamples(before, after, 1, 99))
      .toEqual([{ pid: 10, cpuPercent: 100, command: 'database' }])
  })

  test('lets a long-finished burst go, and excludes the runner', () => {
    const before = sample([[10, 900, 'was-busy'], [99, 1, 'runner']])
    const after = sample([[10, 900, 'was-busy'], [99, 1.4, 'runner']])
    expect(busyProcessesFromSamples(before, after, 0.4, 99)).toEqual([])
  })

  test('rejects smaller processes that consume a core in aggregate, sorted by cost', () => {
    const before = sample([[10, 0, 'renderer'], [20, 0, 'compiler'], [30, 0, 'worker'], [40, 0, 'background']])
    const after = sample([[10, 0.4, 'renderer'], [20, 0.25, 'compiler'], [30, 0.12, 'worker'], [40, 0.08, 'background']])
    expect(busyProcessesFromSamples(before, after, 1, 99)).toEqual([
      { pid: 10, cpuPercent: 40, command: 'renderer' },
      { pid: 20, cpuPercent: 25, command: 'compiler' },
      { pid: 30, cpuPercent: 12, command: 'worker' },
    ])
  })

  test('accepts combined background load below the threshold', () => {
    const before = sample([[10, 0, 'renderer'], [20, 0, 'compiler'], [30, 0, 'worker']])
    const after = sample([[10, 0.4, 'renderer'], [20, 0.25, 'compiler'], [30, 0.099, 'worker']])
    expect(busyProcessesFromSamples(before, after, 1, 99)).toEqual([])
  })

  test('ignores a process that appeared inside the window rather than guessing its rate', () => {
    const before = sample([[10, 0, 'renderer']])
    const after = sample([[10, 0.8, 'renderer'], [20, 900, 'just-started']])
    expect(busyProcessesFromSamples(before, after, 1, 99))
      .toEqual([{ pid: 10, cpuPercent: 80, command: 'renderer' }])
  })

  test('reports no load when the window has no duration', () => {
    expect(busyProcessesFromSamples(sample([[10, 0, 'a']]), sample([[10, 9, 'a']]), 0, 99)).toEqual([])
  })

  test('formats enough detail to identify the process', () => {
    expect(formatBusyProcess({ pid: 20, cpuPercent: 88.44, command: 'compiler' }))
      .toBe('compiler (PID 20, 88.4% CPU)')
  })
})
