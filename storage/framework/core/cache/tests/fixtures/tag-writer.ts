/**
 * One worker for tag-index-processes.test.ts: waits for the shared start time,
 * then writes 100 keys under the tag `feed` to the SQLite cache at argv[2].
 */
import { createCache } from '../../src'
import type { StacksCache } from '../../src'

const [path, who, startAt] = process.argv.slice(2)
const cache = createCache('sqlite', { path }) as StacksCache
await Bun.sleep(Math.max(0, Number(startAt) - Date.now()))
await Promise.all(Array.from({ length: 100 }, (_, i) => cache.tags(['feed']).put(`${who}:${i}`, i, 300)))
await cache.close()
