import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'bun:test'

const mode = process.argv[2]
assert(['success', 'failure', 'timeout'].includes(mode))
const root = await mkdtemp(join(tmpdir(), 'stacks-auto-import-timers-'))
const fixture = join(root, 'primitive.ts')
await Bun.write(fixture, mode === 'success' ? 'export const timerProbe = 42' : mode === 'failure' ? 'throw new Error("primitive fixture failed")' : 'await new Promise(() => {}); export const timerProbe = 42')
const warnings: string[] = []
mock.module('../../src/primitive-imports', () => ({ primitiveModules: [[fixture, ['timerProbe']]], primitiveAutoImportEntries: () => [] }))
mock.module('@stacksjs/path', () => ({ path: { storagePath: (name: string) => join(root, name) } }))
mock.module('@stacksjs/storage', () => ({ globSync: () => [] }))
mock.module('@stacksjs/logging', () => ({ log: { debug() {}, warn() {}, flush() {} } }))
mock.module('@stacksjs/i18n', () => ({ ensureLocalesLoaded() {} }))
mock.module('@stacksjs/events', () => ({ registerAppListeners() {} }))
mock.module('@stacksjs/auth', () => ({ initializeAuthorization() {} }))
const { injectGlobalAutoImports } = await import('../../src/imports')
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const originalWarn = console.warn
const pending = new Set<ReturnType<typeof setTimeout>>()
let armed = 0
let fired = 0
// Observe only the loader's real four-second deadlines. Unrelated imports are
// stubbed above; the initializer, dynamic import and timers remain real.
globalThis.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  if (ms !== 4000)
    return originalSetTimeout(callback, ms, ...args)
  armed++
  const timer = originalSetTimeout(() => {
    pending.delete(timer)
    fired++
    callback(...args)
  }, ms)
  pending.add(timer)
  return timer
}) as typeof setTimeout
globalThis.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => {
  pending.delete(timer)
  return originalClearTimeout(timer)
}) as typeof clearTimeout
console.warn = (...args) => { warnings.push(args.join(' ')) }
try {
  await injectGlobalAutoImports()
  assert.equal(armed, 1)
  assert.equal(pending.size, 0, 'settled primitive imports must release their timeout')
  assert.equal(fired, mode === 'timeout' ? 1 : 0)
  if (mode === 'success') {
    assert.equal((globalThis as Record<string, unknown>).timerProbe, 42)
    assert.deepEqual(warnings, [])
  }
  else {
    assert.equal((globalThis as Record<string, unknown>).timerProbe, undefined)
    assert(warnings.some(message => message.includes(mode === 'failure' ? 'primitive fixture failed' : `auto-import timed out: ${fixture}`)))
  }
  await injectGlobalAutoImports()
  assert.equal(armed, 1, 'the existing initialization guard remains idempotent')
}
finally {
  for (const timer of pending) originalClearTimeout(timer)
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  console.warn = originalWarn
  await rm(root, { recursive: true, force: true })
}
