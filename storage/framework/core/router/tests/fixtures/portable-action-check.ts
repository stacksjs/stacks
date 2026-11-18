import assert from 'node:assert/strict'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

const artifact = join(process.cwd(), 'probe.mjs')
const manifest = join(process.cwd(), 'package.json')
const denied: string[] = []
Bun.plugin({
  name: 'portable-action-only',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (args.path.startsWith('node:') || args.path.startsWith('bun:') || args.path === 'bun' || builtinModules.includes(args.path))
        return
      if (args.path === artifact || args.path === manifest)
        return { path: args.path }
      denied.push(args.path)
      throw new Error(`Portable Action module fallback denied: ${args.path}`)
    })
  },
})

// Prove the guard rejects the original source, then qualify the copied bundle.
await assert.rejects(import(process.argv[2]!), /Portable Action module fallback denied/)
assert.equal(denied.pop(), process.argv[2])
const loaded = await import(artifact)
assert.equal(loaded.default.name, 'PortableStreamProbe')
const response = await loaded.open()
assert.equal(response.status, 200)
const reader = response.body.getReader()
try {
  assert.equal(new TextDecoder().decode((await reader.read()).value), ': connected\n\n')
  loaded.publish()
  assert.match(new TextDecoder().decode((await reader.read()).value), /"portable":true/)
}
finally {
  await reader.cancel()
}
assert.deepEqual(denied, [], 'A copied Action must not import app config, source or installed dependencies')
console.log('PASS portable Action without app config')
