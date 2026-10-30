/**
 * One worker for sqlite-concurrent-open.test.ts: waits for the shared start
 * time, opens the SQLite cache at argv[2], and stores one entry.
 */
import { createCache } from '../../src'

const [path, who, startAt] = process.argv.slice(2)
await Bun.sleep(Math.max(0, Number(startAt) - Date.now()))
const cache = createCache('sqlite', { path })
await cache.set(`opened:${who}`, true)
await cache.close?.()
