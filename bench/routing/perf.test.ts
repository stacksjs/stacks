import { describe, expect, it } from 'bun:test'
import { parseArgs, parseTaskClockMs, resolvePerfBinary } from './perf'

describe('machine-profile options', () => {
  it('defaults to the pair the routing gap is measured between', () => {
    expect(parseArgs([])).toMatchObject({
      targets: ['stacks-minimal', 'elysia'],
      scenario: 'path-param',
      rate: 8000,
      allowBusyHost: false,
    })
    expect(parseArgs(['--targets', 'stacks-warm,hono', '--scenario', 'static-json', '--rate', '12000']))
      .toMatchObject({ targets: ['stacks-warm', 'hono'], scenario: 'static-json', rate: 12_000 })
  })

  it.each(['0', '-1', '1.5', 'NaN', ''])('rejects an unusable rate: %s', (value) => {
    expect(() => parseArgs(['--rate', value])).toThrow()
  })

  it('names an unknown target or scenario rather than profiling nothing', () => {
    expect(() => parseArgs(['--targets', 'stacks-minimal,nope'])).toThrow(/nope/)
    expect(() => parseArgs(['--scenario', 'nope'])).toThrow(/nope/)
  })
})

describe('task-clock parsing', () => {
  it('reads the milliseconds perf prints, separators and all', () => {
    // The real shape, including the thousands separator perf emits.
    expect(parseTaskClockMs('         12,345.67 msec task-clock               #    0.411 CPUs utilized')).toBeCloseTo(12_345.67, 2)
    expect(parseTaskClockMs('            420.00 msec task-clock')).toBe(420)
  })

  it('reports no reading rather than zero when the counter is absent', () => {
    // Zero would read as a free server, which is the one answer that must not
    // come out of a failed attachment.
    expect(parseTaskClockMs('   <not supported>      task-clock')).toBeNull()
    expect(parseTaskClockMs('')).toBeNull()
  })
})

describe('perf binary resolution', () => {
  it('returns null rather than a binary that cannot attach', async () => {
    expect(await resolvePerfBinary(['/definitely/not/perf'])).toBeNull()
  })
})
