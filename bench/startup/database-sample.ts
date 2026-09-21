import assert from 'node:assert/strict'
import process from 'node:process'

const entry = process.argv[2]
assert(entry, 'Expected a built database entry path')

const started = performance.now()
const runtime = await import(entry)
const importMs = performance.now() - started

for (const name of ['db', 'getDatabaseDialect', 'sql', 'sqlDateTime', 'withRoutingContext'])
  assert(name in runtime, `${name} is missing from ${entry}`)

Bun.gc(true)
await Bun.sleep(20)

console.log(JSON.stringify({
  importMs,
  rssBytes: process.memoryUsage().rss,
}))
