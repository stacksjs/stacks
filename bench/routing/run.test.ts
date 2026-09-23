import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parseArgs } from './run'
import { DEFAULT_TARGETS, TARGETS } from './targets'

describe('routing benchmark options', () => {
  it('preserves the default matrix and accepts fractional timing windows', () => {
    expect(parseArgs([])).toMatchObject({
      targets: DEFAULT_TARGETS.map(target => target.id),
      connections: 50,
      warmupSeconds: 5,
      durationSeconds: 30,
      runs: 3,
      db: true,
      allowBusyHost: false,
    })
    expect(parseArgs(['-c', '2', '-d', '0.5', '--warmup', '0.25', '--runs', '1'])).toMatchObject({
      connections: 2, durationSeconds: 0.5, warmupSeconds: 0.25, runs: 1,
    })
    expect(parseArgs(['--warmup', '0']).warmupSeconds).toBe(0)
    expect(parseArgs(['--allow-busy-host']).allowBusyHost).toBe(true)
    expect(parseArgs(['--output', '/tmp/routing-result']).output).toBe('/tmp/routing-result')
  })

  it('leaves the rate unset unless asked, and takes a positive integer when it is', () => {
    expect(parseArgs([]).requestRate).toBeUndefined()
    expect(parseArgs(['--rate', '25000']).requestRate).toBe(25_000)
  })

  it.each(['--connections', '--runs', '--rate'])('requires a positive safe integer for %s', (flag) => {
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992', ''])
      expect(() => parseArgs([flag, value]), `${flag} ${value}`).toThrow()
  })

  it.each(['0', '-1', 'NaN', 'Infinity', ''])('rejects invalid measured duration %s', (value) => {
    expect(() => parseArgs(['--duration', value])).toThrow()
  })

  it.each(['-1', 'NaN', 'Infinity', ''])('rejects invalid warmup %s', (value) => {
    expect(() => parseArgs(['--warmup', value])).toThrow()
  })

  it.each(['missing', 'stacks,missing', '', 'stacks,'])('rejects unknown or empty target selections: %s', (value) => {
    expect(() => parseArgs(['--targets', value])).toThrow()
  })

  it.each(['missing', 'static-json,missing', '', 'static-json,'])('rejects unknown or empty scenario selections: %s', (value) => {
    expect(() => parseArgs(['--scenarios', value])).toThrow()
  })

  it('rejects a matrix emptied by --no-db', () => {
    expect(() => parseArgs(['--scenarios', 'db-roundtrip', '--no-db'])).toThrow('No scenarios')
  })

  it('accepts explicit tuned targets and a mixed matrix with --no-db', () => {
    expect(parseArgs(['--targets', 'stacks-wal-full,bun-raw', '--scenarios', 'static-json,db-roundtrip', '--no-db'])).toMatchObject({
      targets: ['stacks-wal-full', 'bun-raw'], scenarios: ['static-json', 'db-roundtrip'], db: false,
    })
  })

  it('rejects missing values and unknown flags', () => {
    expect(() => parseArgs(['--runs'])).toThrow('--runs needs a value')
    expect(() => parseArgs(['--output'])).toThrow('--output needs a value')
    expect(() => parseArgs(['--mystery'])).toThrow('Unknown flag')
  })
})

/**
 * An ablation target prices one feature by differing from another target in one
 * environment variable, and it is opt-in so that switching a feature off never
 * quietly becomes a published number. That leaves the routing diagnostic as the
 * only place they can run on hardware whose spread is small enough to resolve
 * the difference, so the workflow has to be able to select them.
 */
describe('ablation targets stay reachable', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/routing-benchmark.yml', import.meta.url), 'utf8')
  const optIn = TARGETS.filter(target => target.optIn)

  it('keeps every opt-in target out of the default matrix and selectable by id', () => {
    expect(optIn.length).toBeGreaterThan(0)
    for (const target of optIn) {
      expect(DEFAULT_TARGETS.map(t => t.id)).not.toContain(target.id)
      expect(parseArgs(['--targets', target.id]).targets).toEqual([target.id])
    }
  })

  it('prices the ambient request scope against exactly one other target', () => {
    // `stacks-no-context` is `stacks-minimal` plus one variable. If that stops
    // being true the pair no longer measures the request scope on its own.
    const minimal = TARGETS.find(t => t.id === 'stacks-minimal')!
    const noContext = TARGETS.find(t => t.id === 'stacks-no-context')!
    expect({ ...noContext.env }).toEqual({ ...minimal.env, BENCH_REQUEST_CONTEXT: 'false' })
  })

  it('lets the routing diagnostic choose targets and repeat count without changing the defaults', () => {
    expect(workflow).toContain('      targets:')
    expect(workflow).toContain('      runs:')
    // Forwarded as a variable rather than expanded into the script, so a target
    // list cannot become a command.
    expect(workflow).toContain('BENCH_TARGETS: ${{ inputs.targets }}')
    expect(workflow.match(/BENCH_RUNS: \$\{\{ inputs\.runs \}\}/g)).toHaveLength(2)
    const forwarding = workflow.match(/\$\{BENCH_TARGETS:\+--targets "\$BENCH_TARGETS"\}/g) ?? []
    expect(forwarding).toHaveLength(2) // the benchmark and cost steps
    expect(workflow.match(/--runs "\$BENCH_RUNS"/g)).toHaveLength(2)
    expect(workflow).not.toContain('--runs "${{ inputs.runs }}"')
    expect(workflow).toContain('BENCH_RATE: ${{ inputs.rate }}')
    expect(workflow.match(/--rate "\$BENCH_RATE"/g)).toHaveLength(3)
    expect(workflow).not.toContain('--rate "${{ inputs.rate }}"')
    // An unset input has to leave the published matrix exactly as it was.
    expect(workflow).toMatch(/targets:\n\s+description:[\s\S]*?default: ''/)
    expect(workflow).toMatch(/runs:\n\s+description:[\s\S]*?default: '3'/)
  })
})
