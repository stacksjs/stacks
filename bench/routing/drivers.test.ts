import { describe, expect, it, spyOn } from 'bun:test'
import process from 'node:process'
import { DRIVERS, ohaArgs } from './drivers'

describe('publication-capable drivers', () => {
  it('allows only the native generator that exposes exact status counts', () => {
    expect(DRIVERS.filter(driver => driver.publishable).map(driver => driver.name)).toEqual(['oha'])
  })
})

describe('oha command', () => {
  it('applies one global fixed request rate with latency correction', () => {
    expect(ohaArgs({
      url: 'http://127.0.0.1:39400/bench/json',
      method: 'GET',
      headers: {},
      connections: 64,
      warmupSeconds: 0,
      durationSeconds: 60,
      requestRate: 40_000,
    }, 60)).toEqual([
      'oha', '-z', '60s', '-c', '64', '-q', '40000', '--latency-correction',
      '--wait-ongoing-requests-after-deadline', '--no-tui', '--output-format', 'json',
      'http://127.0.0.1:39400/bench/json',
    ])
  })

  it.each([
    ['transport failures only', {}, { 'Connection refused (os error 61)': 20 }, 20, 20],
    ['mixed responses and transport failures', { 200: 70, 302: 10, 500: 10 }, { timeout: 10 }, 100, 30],
    ['responses without transport failures', { 200: 20 }, undefined, 20, 0],
  ] as const)('counts every completed or failed request: %s', async (name, codes, transportErrors, requests, errors) => {
    const raw = JSON.stringify({
      summary: { requestsPerSec: 100 },
      statusCodeDistribution: codes,
      errorDistribution: transportErrors,
    })
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
      stdout: new Response(raw).body,
      stderr: new Response('').body,
      exited: Promise.resolve(0),
    } as unknown as ReturnType<typeof Bun.spawn>)
    try {
      const result = await DRIVERS.find(driver => driver.name === 'oha')!.run({
        url: 'http://127.0.0.1:39400/bench/json',
        method: 'GET',
        headers: {},
        connections: 1,
        warmupSeconds: 0,
        durationSeconds: 1,
      })
      expect(result.requests, name).toBe(requests)
      expect(result.errors, name).toBe(errors)
      expect(result.raw).toBe(raw)
    }
    finally {
      spawn.mockRestore()
    }
  })
})

describe('autocannon load isolation', () => {
  it.each([
    ['transport failures only', 0, 20, 0, 0, 20, 20],
    ['mixed responses and failures', 90, 10, 10, 3, 100, 20],
    ['responses without failures', 20, undefined, undefined, undefined, 20, 0],
  ] as const)('counts every completed or failed request: %s', async (name, completed, transportErrors, non2xx, timeouts, requests, errors) => {
    const raw = JSON.stringify({ requests: { total: completed }, errors: transportErrors, non2xx, timeouts })
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
      stdout: new Response(raw).body,
      stderr: new Response('').body,
      exited: Promise.resolve(0),
    } as unknown as ReturnType<typeof Bun.spawn>)
    try {
      const result = await DRIVERS.find(driver => driver.name === 'autocannon')!.run({
        url: 'http://127.0.0.1:39400/bench/json',
        method: 'GET',
        headers: {},
        connections: 1,
        warmupSeconds: 0,
        durationSeconds: 1,
      })
      expect(result.requests, name).toBe(requests)
      expect(result.errors, name).toBe(errors)
      expect(result.raw).toBe(raw)
    }
    finally {
      spawn.mockRestore()
    }
  })

  it.each([0, 3])('discards %s seconds of warmup with isolated load settings', async (warmupSeconds) => {
    const output = (requests: number) => ({
      stdout: new Response(JSON.stringify({ requests: { total: requests, average: requests } })).body,
      stderr: new Response('').body,
      exited: Promise.resolve(0),
    }) as unknown as ReturnType<typeof Bun.spawn>
    const originalPort = process.env.PORT
    const spawn = spyOn(Bun, 'spawn')
    if (warmupSeconds > 0) spawn.mockReturnValueOnce(output(999))
    spawn.mockReturnValueOnce(output(42))
    try {
      process.env.PORT = 'application-port-fixture'
      const result = await DRIVERS.find(driver => driver.name === 'autocannon')!.run({
        url: 'http://127.0.0.1:39400/bench/echo',
        method: 'POST',
        body: '{"name":"bench","count":7}',
        headers: { 'content-type': 'application/json', 'x-bench': 'preserved' },
        connections: 7,
        warmupSeconds,
        durationSeconds: 11,
      })
      expect(result.requests).toBe(42)
      expect(JSON.parse(result.raw).requests.total).toBe(42)
      const commands = spawn.mock.calls.map(call => call[0] as string[])
      expect(commands.map(args => args[args.indexOf('-d') + 1])).toEqual(warmupSeconds > 0 ? ['3', '11'] : ['11'])
      expect(process.env.PORT).toBe('application-port-fixture')
      for (const call of spawn.mock.calls) {
        const args = call[0] as string[]
        const options = call[1] as { env?: Record<string, string | undefined> }
        expect(options.env?.PORT).toBe('')
        expect(args.at(-1)).toBe('http://127.0.0.1:39400/bench/echo')
        expect(args).not.toContain('-w')
        expect(args[args.indexOf('-c') + 1]).toBe('7')
        expect(args[args.indexOf('-m') + 1]).toBe('POST')
        expect(args[args.indexOf('-b') + 1]).toBe('{"name":"bench","count":7}')
        expect(args).toContain('content-type: application/json')
        expect(args).toContain('x-bench: preserved')
      }
    }
    finally {
      spawn.mockRestore()
      if (originalPort === undefined) delete process.env.PORT
      else process.env.PORT = originalPort
    }
  })
})

/**
 * A percentile the tool did not report must stay absent (stacksjs/stacks#2470).
 *
 * The oha adapter used `?? 0`, so a missing p99 became 0 ms - the best
 * possible latency - and every downstream check passed it. The fixture in the
 * request-counting tests above omits `latencyPercentiles` entirely, which is
 * exactly why the substitution went unnoticed for so long.
 *
 * The key path and units here were taken from real captured oha output
 * (routing diagnostic run 34196555986): `latencyPercentiles` holds seconds,
 * so 0.000407146 is 0.407 ms.
 */
describe('latency percentiles preserve absence', () => {
  const runOha = async (json: unknown) => {
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
      stdout: new Response(JSON.stringify(json)).body,
      stderr: new Response('').body,
      exited: Promise.resolve(0),
    } as unknown as ReturnType<typeof Bun.spawn>)
    try {
      const driver = DRIVERS.find(d => d.name === 'oha')!
      return await driver.run({
        url: 'http://127.0.0.1:39400/bench/json',
        method: 'GET',
        headers: {},
        connections: 8,
        warmupSeconds: 0,
        durationSeconds: 1,
      })
    }
    finally {
      spawn.mockRestore()
    }
  }

  const base = {
    summary: { requestsPerSec: 100 },
    statusCodeDistribution: { 200: 100 },
  }

  it('converts real oha seconds into milliseconds', async () => {
    const result = await runOha({
      ...base,
      latencyPercentiles: { p50: 0.000407146, p90: 0.00050315, p99: 0.00076389 },
    })

    expect(result.latencyMs.p50).toBeCloseTo(0.407146, 6)
    expect(result.latencyMs.p90).toBeCloseTo(0.50315, 6)
    expect(result.latencyMs.p99).toBeCloseTo(0.76389, 6)
  })

  it('reports an absent percentile as null, never as zero latency', async () => {
    const result = await runOha({ ...base, latencyPercentiles: { p50: 0.0004, p90: 0.0005 } })

    expect(result.latencyMs.p50).toBeCloseTo(0.4, 6)
    expect(result.latencyMs.p99).toBeNull()
  })

  it('reports an explicitly null percentile as null', async () => {
    const result = await runOha({ ...base, latencyPercentiles: { p50: null, p90: null, p99: null } })

    expect(result.latencyMs).toEqual({ p50: null, p90: null, p99: null })
  })

  it('reports a missing percentile block as null rather than three zeroes', async () => {
    const result = await runOha(base)

    expect(result.latencyMs).toEqual({ p50: null, p90: null, p99: null })
  })

  it('rejects a non-numeric percentile instead of producing NaN', async () => {
    // `'fast' * 1000` is NaN, which is finite-checked nowhere upstream and
    // renders as NaN in the report.
    const result = await runOha({ ...base, latencyPercentiles: { p50: 'fast', p90: 0.0005, p99: 0.0007 } })

    expect(result.latencyMs.p50).toBeNull()
    expect(result.latencyMs.p90).toBeCloseTo(0.5, 6)
  })
})
