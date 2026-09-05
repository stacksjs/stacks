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
