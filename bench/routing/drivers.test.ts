import { describe, expect, it, spyOn } from 'bun:test'
import process from 'node:process'
import { DRIVERS, ohaArgs } from './drivers'

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
})

describe('autocannon load isolation', () => {
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
