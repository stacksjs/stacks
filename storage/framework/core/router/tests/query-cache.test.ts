import type { EnhancedRequest } from '@stacksjs/bun-router'
import { describe, expect, test } from 'bun:test'
import process from 'node:process'
import { cacheRequestQuery, getCurrentRequest, runWithRequest } from '../src/request-context'

function request(path = '/') {
  return new Request(`https://example.test${path}`) as EnhancedRequest
}

describe('request query cache', () => {
  test('deduplicates pending and completed queries without starting the fetch inline', async () => {
    await runWithRequest(request(), async () => {
      let calls = 0
      const pending = Promise.withResolvers<{ id: number }>()
      const fetcher = () => {
        calls++
        return pending.promise
      }
      const first = cacheRequestQuery('user:1', fetcher)
      const second = cacheRequestQuery('user:1', fetcher)
      expect(calls).toBe(0)
      await Promise.resolve()
      expect(calls).toBe(1)
      const row = { id: 1 }
      pending.resolve(row)
      expect(await first).toBe(row)
      expect(await second).toBe(row)
      expect(await cacheRequestQuery('user:1', fetcher)).toBe(row)
      expect(calls).toBe(1)
    })
  })

  test('keeps keys and overlapping request scopes isolated', async () => {
    const ready = Promise.withResolvers<void>()
    const firstRequest = request('/one')
    const secondRequest = request('/two')
    let calls = 0
    const fetcher = async () => {
      calls++
      await ready.promise
      return getCurrentRequest()?.url
    }
    const first = runWithRequest(firstRequest, () => cacheRequestQuery('shared', fetcher))
    const second = runWithRequest(secondRequest, async () => {
      const shared = cacheRequestQuery('shared', fetcher)
      const other = cacheRequestQuery('other', () => 'other key')
      expect(await other).toBe('other key')
      return shared
    })
    ready.resolve()
    expect(await first).toBe(firstRequest.url)
    expect(await second).toBe(secondRequest.url)
    expect(calls).toBe(2)
  })

  test('a reentrant lookup joins the pending operation', async () => {
    await runWithRequest(request(), async () => {
      let joined: Promise<number> | undefined
      let unexpectedCalls = 0
      const first = cacheRequestQuery('same', () => {
        joined = cacheRequestQuery('same', () => ++unexpectedCalls)
        return 42
      })
      expect(await first).toBe(42)
      expect(await joined).toBe(42)
      expect(unexpectedCalls).toBe(0)
    })
  })

  test('undefined query results remain cached', async () => {
    await runWithRequest(request(), async () => {
      let calls = 0
      const fetcher = () => { calls++ }
      expect(await cacheRequestQuery('empty', fetcher)).toBeUndefined()
      expect(await cacheRequestQuery('empty', fetcher)).toBeUndefined()
      expect(calls).toBe(1)
    })
  })

  test.each(['sync', 'async'])('shares a %s failure and permits a fresh retry', async (mode) => {
    await runWithRequest(request(), async () => {
      const failure = new Error('query failed')
      let calls = 0
      const fetcher = () => {
        calls++
        if (mode === 'sync') throw failure
        return Promise.reject(failure)
      }
      const results = await Promise.allSettled([
        cacheRequestQuery('user:1', fetcher),
        cacheRequestQuery('user:1', fetcher),
      ])
      expect(results).toEqual([
        { status: 'rejected', reason: failure },
        { status: 'rejected', reason: failure },
      ])
      expect(calls).toBe(1)
      expect(await cacheRequestQuery('user:1', () => ++calls)).toBe(2)
    })
  })

  test('outside a request invokes fetchers immediately without caching', async () => {
    expect(getCurrentRequest()).toBeUndefined()
    let calls = 0
    const first = cacheRequestQuery('same', () => ++calls)
    expect(first).toBeInstanceOf(Promise)
    expect(calls).toBe(1)
    const second = cacheRequestQuery('same', () => ++calls)
    expect(calls).toBe(2)
    expect(await first).toBe(1)
    expect(await second).toBe(2)
  })

  test('outside a request synchronous throws and asynchronous failures reject', async () => {
    const failure = new Error('query failed')
    let thrown: Promise<never> | undefined
    expect(() => {
      thrown = cacheRequestQuery('same', () => { throw failure })
    }).not.toThrow()
    expect(thrown).toBeInstanceOf(Promise)
    await expect(thrown).rejects.toBe(failure)
    await expect(cacheRequestQuery('same', () => Promise.reject(failure))).rejects.toBe(failure)
  })

  test('a failure to attach request state rejects instead of throwing inline', async () => {
    await runWithRequest(Object.freeze(request()), async () => {
      let result: Promise<number> | undefined
      expect(() => {
        result = cacheRequestQuery('same', () => 1)
      }).not.toThrow()
      await expect(result).rejects.toBeInstanceOf(TypeError)
    })
  })

  test('an ignored query failure is still reported as an unhandled rejection', async () => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/query-cache-rejection.ts`,
    ], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 10_000)
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
      expect(JSON.parse(stdout)).toEqual({ unhandled: ['ignored query', 'mixed callers', 'ignored first caller'], retried: 42 })
    }
    finally {
      clearTimeout(timeout)
    }
  })
})
