import type { Driver, LoadRequest, LoadResult } from './drivers'
import { describe, expect, it, spyOn } from 'bun:test'
import { measureLoad } from './measurement'

const result: LoadResult = {
  rpsMean: 42,
  rpsP50: 42,
  latencyMs: { p50: 1, p90: 2, p99: 3 },
  requests: 42,
  errors: 0,
  raw: 'measured output',
}

describe('benchmark CPU window', () => {
  it.each([0, 3])('excludes %s seconds of warmup CPU and wall time', async (warmupSeconds) => {
    let cpu = 0
    let wall = 0
    const requests: LoadRequest[] = []
    const request: LoadRequest = {
      url: 'http://127.0.0.1:39400/bench/echo',
      method: 'POST',
      body: '{"name":"bench","count":7}',
      headers: { 'content-type': 'application/json' },
      connections: 7,
      requestRate: 100,
      warmupSeconds,
      durationSeconds: 1,
    }
    const driver: Driver = {
      name: 'fixture',
      publishable: false,
      supportsFixedRate: true,
      isAvailable: async () => true,
      async run(load) {
        requests.push(load)
        // A busy warmup and a mostly idle measured window make mixing the
        // two visible in the reported percentage, without timing a real CPU.
        cpu += load.warmupSeconds
        wall += load.warmupSeconds * 1000
        cpu += load.durationSeconds === 1 ? 0.1 : load.durationSeconds
        wall += load.durationSeconds * 1000
        return load.durationSeconds === 1 ? result : { ...result, requests: 999, raw: 'warmup output' }
      },
    }
    const spawn = spyOn(Bun, 'spawn').mockImplementation(() => ({
      stdout: new Response(`00:${cpu.toFixed(2)}`).body,
    }) as unknown as ReturnType<typeof Bun.spawn>)
    const now = spyOn(performance, 'now').mockImplementation(() => wall)
    try {
      const measured = await measureLoad(driver, request, 123)
      expect(measured.cpuPercent).toBeCloseTo(10, 8)
      expect(measured.result).toBe(result)
      expect(measured.warmupResult).toEqual(warmupSeconds > 0 ? { ...result, requests: 999, raw: 'warmup output' } : null)
      expect(requests).toEqual(warmupSeconds > 0
        ? [{ ...request, warmupSeconds: 0, durationSeconds: warmupSeconds }, { ...request, warmupSeconds: 0 }]
        : [{ ...request, warmupSeconds: 0 }])
    }
    finally {
      now.mockRestore()
      spawn.mockRestore()
    }
  })
})

// ps emits minutes, hours, and a day prefix as the accumulated CPU time grows.
// Drive the reported percentage through the sampler, including boundary changes.
describe('cumulative CPU time formats', () => {
  it.each([
    ['minute boundary', '00:59.90', '01:00.10', 20],
    ['hour boundary', '59:59.90', '01:00:00.10', 20],
    ['first day boundary', '23:59:59.90', '1-00:00:00.10', 20],
    ['later day boundary', '1-23:59:59.90', '2-00:00:00.10', 20],
    ['day and hours', '2-03:00:00', '2-03:00:01', 100],
    ['missing sample', '', '00:00.10', null],
    ['malformed sample', '00:00oops', '00:00.10', null],
  ] as const)('%s', async (name, before, after, expected) => {
    let wall = 0
    let sample: string = before
    const spawn = spyOn(Bun, 'spawn').mockImplementation(() => ({
      stdout: new Response(sample).body,
    }) as unknown as ReturnType<typeof Bun.spawn>)
    const now = spyOn(performance, 'now').mockImplementation(() => wall)
    try {
      const measured = await measureLoad({
        name,
        publishable: false,
        supportsFixedRate: false,
        isAvailable: async () => true,
        async run() {
          wall = 1000
          sample = after
          return result
        },
      }, {
        url: 'http://127.0.0.1:39400/bench/json',
        method: 'GET',
        headers: {},
        connections: 1,
        warmupSeconds: 0,
        durationSeconds: 1,
      }, 123)
      if (expected == null) expect(measured.cpuPercent).toBeNull()
      else expect(measured.cpuPercent).toBeCloseTo(expected, 6)
      expect(measured.result).toBe(result)
    }
    finally {
      now.mockRestore()
      spawn.mockRestore()
    }
  })
})
