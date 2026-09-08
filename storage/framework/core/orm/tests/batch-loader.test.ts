import type { EnhancedRequest } from '@stacksjs/router'
import { describe, expect, test } from 'bun:test'
import { getCurrentRequest, runWithRequest } from '@stacksjs/router'
import { batchLoad } from '../src/batch-loader'

function request(tenant = 'one') {
  return new Request('https://example.test', { headers: { 'x-tenant': tenant } }) as EnhancedRequest
}

describe('request-scoped model batches', () => {
  test('overlapping requests query and receive rows under their own context', async () => {
    const queries: { tenant: string | null | undefined, ids: number[] }[] = []
    const model = {
      name: 'TenantRow',
      async findMany(ids: number[]) {
        const tenant = getCurrentRequest()?.headers.get('x-tenant')
        queries.push({ tenant, ids })
        await Promise.resolve()
        expect(getCurrentRequest()?.headers.get('x-tenant')).toBe(tenant)
        return ids.map(id => ({ id, tenant }))
      },
    }
    const rows = await Promise.all(['one', 'two'].map(tenant => runWithRequest(request(tenant), () => batchLoad(model, 1))))
    expect(rows).toEqual([{ id: 1, tenant: 'one' }, { id: 1, tenant: 'two' }])
    expect(queries).toEqual([{ tenant: 'one', ids: [1] }, { tenant: 'two', ids: [1] }])
  })

  test('one request batches distinct ids and reuses pending and settled rows', async () => {
    const queries: number[][] = []
    const model = {
      async findMany(ids: number[]) {
        queries.push(ids)
        return ids.slice().reverse().map(id => ({ id }))
      },
    }
    await runWithRequest(request(), async () => {
      const first = batchLoad(model, 1)
      const duplicate = batchLoad(model, 1)
      const second = batchLoad(model, 2)
      expect(queries).toEqual([])
      const rows = await Promise.all([first, duplicate, second])
      expect(rows).toEqual([{ id: 1 }, { id: 1 }, { id: 2 }])
      expect(rows[0]).toBe(rows[1])
      expect(await batchLoad(model, 1)).toBe(rows[0])
      expect(queries).toEqual([[1, 2]])
    })
  })

  test.each(['SameName', undefined])('model object identity isolates models named %s', async (name) => {
    const first = { name, async findMany(ids: number[]) { return ids.map(id => ({ id, source: 'first' })) } }
    const second = { name, async findMany(ids: number[]) { return ids.map(id => ({ id, source: 'second' })) } }
    await runWithRequest(request(), async () => {
      expect(await Promise.all([batchLoad(first, 1), batchLoad(second, 1)])).toEqual([
        { id: 1, source: 'first' }, { id: 1, source: 'second' },
      ])
      expect(await batchLoad(second, 1)).toEqual({ id: 1, source: 'second' })
    })
  })

  test('numeric and string keys remain distinct', async () => {
    const queries: (string | number)[][] = []
    const model = {
      async findMany(ids: (string | number)[]) {
        queries.push(ids)
        return ids.map(id => ({ id, type: typeof id }))
      },
    }
    await runWithRequest(request(), async () => {
      expect(await Promise.all([batchLoad(model, 1), batchLoad(model, '1')])).toEqual([
        { id: 1, type: 'number' }, { id: '1', type: 'string' },
      ])
      expect(queries).toEqual([[1, '1']])
    })
  })

  test('missing rows are cached as undefined for that request only', async () => {
    let calls = 0
    const model = { async findMany() { calls++; return [] } }
    await runWithRequest(request(), async () => {
      expect(await batchLoad(model, 1)).toBeUndefined()
      expect(await batchLoad(model, 1)).toBeUndefined()
      expect(calls).toBe(1)
    })
    await runWithRequest(request(), async () => {
      expect(await batchLoad(model, 1)).toBeUndefined()
      expect(calls).toBe(2)
    })
  })

  test('failed batches reject every caller and can be retried', async () => {
    let calls = 0
    const failure = new Error('query unavailable')
    const model = {
      async findMany(ids: number[]) {
        if (++calls === 1) throw failure
        return ids.map(id => ({ id }))
      },
    }
    await runWithRequest(request(), async () => {
      const results = await Promise.allSettled([batchLoad(model, 1), batchLoad(model, 1), batchLoad(model, 2)])
      expect(results).toEqual(Array.from({ length: 3 }, () => ({ status: 'rejected', reason: failure })))
      expect(await Promise.all([batchLoad(model, 1), batchLoad(model, 2)])).toEqual([{ id: 1 }, { id: 2 }])
      expect(calls).toBe(2)
    })
  })

  test('a later batch can finish while an earlier query is still in flight', async () => {
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const queries: number[][] = []
    const model = {
      async findMany(ids: number[]) {
        queries.push(ids)
        if (ids.includes(1)) {
          started.resolve()
          await release.promise
        }
        return ids.map(id => ({ id }))
      },
    }
    await runWithRequest(request(), async () => {
      const first = batchLoad(model, 1)
      await started.promise
      const duplicate = batchLoad(model, 1)
      expect(await batchLoad(model, 2)).toEqual({ id: 2 })
      release.resolve()
      expect(await first).toBe(await duplicate)
      expect(queries).toEqual([[1], [2]])
    })
  })

  test('a failed request does not reject another request sharing a model', async () => {
    const failure = new Error('one request failed')
    const model = {
      async findMany(ids: number[]) {
        if (getCurrentRequest()?.headers.get('x-tenant') === 'one') throw failure
        return ids.map(id => ({ id }))
      },
    }
    expect(await Promise.allSettled(['one', 'two'].map(tenant => runWithRequest(request(tenant), () => batchLoad(model, 1))))).toEqual([
      { status: 'rejected', reason: failure }, { status: 'fulfilled', value: { id: 1 } },
    ])
  })

  test('outside requests uses independent single-id lookups', async () => {
    expect(getCurrentRequest()).toBeUndefined()
    const found: number[] = []
    const model = {
      async find(id: number) { found.push(id); return { id } },
      async findMany() { throw new Error('outside requests must use find when available') },
    }
    expect(await Promise.all([batchLoad(model, 1), batchLoad(model, 1), batchLoad(model, 2)])).toEqual([{ id: 1 }, { id: 1 }, { id: 2 }])
    expect(found).toEqual([1, 1, 2])
  })

  test('outside requests falls back to unbatched findMany for models without find', async () => {
    const queries: number[][] = []
    const model = { async findMany(ids: number[]) { queries.push(ids); return ids.map(id => ({ id })) } }
    expect(await Promise.all([batchLoad(model, 1), batchLoad(model, 2)])).toEqual([{ id: 1 }, { id: 2 }])
    expect(queries).toEqual([[1], [2]])
  })

  test('find-only models keep request-local deduplication', async () => {
    const keys: number[] = []
    const model = { async find(id: number) { keys.push(id); return id === 2 ? undefined : { id } } }
    await runWithRequest(request(), async () => {
      expect(await Promise.all([batchLoad(model, 1), batchLoad(model, 1), batchLoad(model, 2)])).toEqual([{ id: 1 }, { id: 1 }, undefined])
      expect(keys).toEqual([1, 2])
    })
  })
})
