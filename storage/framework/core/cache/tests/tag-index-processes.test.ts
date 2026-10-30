import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import type { StacksCache } from '../src'
import { createCache } from '../src'

// stacksjs/stacks#3073. The tag index was one array, updated by read, add,
// write, and only serialized inside a process. Two workers on a shared store
// both read it, each added a key, and the second write dropped the first
// worker's key, which no flush then deleted. In-process ordering is pinned by
// tagged-flush-race.test.ts; this needs real processes, because the lock that
// orders writes is per process.

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('a tag index shared by processes', () => {
  it('flushes every key two processes wrote under one tag at the same time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-tag-processes-'))
    dirs.push(dir)
    const path = join(dir, 'cache.sqlite')
    const writer = join(import.meta.dir, 'fixtures', 'tag-writer.ts')
    // Both start writing at the same instant, whatever each one's startup cost.
    const startAt = String(Date.now() + 1500)

    const workers = ['a', 'b'].map(who => Bun.spawn([process.execPath, writer, path, who, startAt], { stdout: 'pipe', stderr: 'pipe' }))
    expect(await Promise.all(workers.map(worker => worker.exited))).toEqual([0, 0])

    const cache = createCache('sqlite', { path }) as StacksCache
    const written = (await cache.keys()).filter(key => /^[ab]:\d+$/.test(key))
    expect(written).toHaveLength(200)

    expect(await cache.tags(['feed']).flush()).toBe(200)
    expect((await cache.keys()).filter(key => /^[ab]:\d+$/.test(key))).toEqual([])
    await cache.close()
  }, 30_000)
})

describe('the tag index, one entry per key', () => {
  const fresh = (): StacksCache => createCache('memory') as StacksCache

  it('still flushes the keys an index written as one array holds', async () => {
    const cache = fresh()
    await cache.set('old:1', 1)
    await cache.set('old:2', 2)
    await cache.setForever('__stacks_tag__:feed', ['old:1', 'old:2'])
    await cache.tags(['feed']).put('new:1', 3)

    expect(await cache.tags(['feed']).flush()).toBe(3)
    expect(await cache.keys()).toEqual([])
  })

  it('lets an entry expire with its key, so the index does not grow for ever', async () => {
    const cache = fresh()
    await cache.tags(['feed']).put('short', 1, 1)
    await cache.tags(['feed']).setForever('kept', 2)
    expect((await cache.keys()).filter(key => key.startsWith('__stacks_tag__:'))).toHaveLength(2)

    await Bun.sleep(1100)
    expect((await cache.keys()).filter(key => key.startsWith('__stacks_tag__:'))).toHaveLength(1)
  })

  it('flushes only its own tag when another tag name starts with it', async () => {
    // Listed by the raw name, `a`'s entries would be `__stacks_tag__:a:*`,
    // which also matches `a:b`'s entry for `x` and reads it as the key `b:x`.
    const cache = fresh()
    await cache.tags(['a:b']).put('x', 1)
    await cache.set('b:x', 2)

    expect(await cache.tags(['a']).flush()).toBe(0)
    expect(await cache.get('x')).toBe(1)
    expect(await cache.get('b:x')).toBe(2)
  })
})
