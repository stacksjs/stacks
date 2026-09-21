import { config, registerPersistentQueryHooks, setConfig } from '../../src/index'

setConfig({ hooks: undefined })
if (config.hooks !== undefined)
  throw new Error('An empty hook registry should leave upstream hooks disabled')

let persistentCalls = 0
const unregister = registerPersistentQueryHooks({
  onQueryEnd: () => persistentCalls++,
})

config.hooks?.onQueryEnd?.({ sql: 'select 1', durationMs: 1, kind: 'select' })
if (persistentCalls !== 1)
  throw new Error('A registered persistent hook did not receive the query')

unregister()
if (config.hooks !== undefined)
  throw new Error('Removing the last hook should restore the upstream fast path')

// Only the kinds some listener defines get a dispatcher: bun-query-builder
// calls onQueryStart and onQueryEnd on every successful query when they are
// set, so an error-only listener must not install them.
function installedKinds(): string {
  return JSON.stringify(Object.keys(config.hooks ?? {}).sort())
}
const unregisterErrorOnly = registerPersistentQueryHooks({ onQueryError: () => {} })
if (installedKinds() !== '["onQueryError"]')
  throw new Error(`An error-only hook set should install only onQueryError, installed ${installedKinds()}`)
setConfig({ hooks: { onSlowQuery: () => {} } })
if (installedKinds() !== '["onQueryError","onSlowQuery"]')
  throw new Error(`Configured and persistent hook kinds should combine, installed ${installedKinds()}`)
setConfig({ hooks: undefined })
if (installedKinds() !== '["onQueryError"]')
  throw new Error(`Clearing configured hooks should drop their kinds, installed ${installedKinds()}`)
const unregisterEndOnly = registerPersistentQueryHooks({ onQueryEnd: () => {} })
unregisterEndOnly()
if (installedKinds() !== '["onQueryError"]')
  throw new Error(`Removing a hook set should drop the kinds only it defined, installed ${installedKinds()}`)
unregisterErrorOnly()
if (config.hooks !== undefined)
  throw new Error('Removing the error-only hook should restore the upstream fast path')

let configuredCalls = 0
setConfig({ hooks: { onQueryEnd: () => configuredCalls++ } })
const unregisterSecond = registerPersistentQueryHooks({
  onQueryEnd: () => persistentCalls++,
})

config.hooks?.onQueryEnd?.({ sql: 'select 2', durationMs: 1, kind: 'select' })
if (configuredCalls !== 1 || persistentCalls !== 2)
  throw new Error('Configured and persistent hooks should compose')

unregisterSecond()
config.hooks?.onQueryEnd?.({ sql: 'select 3', durationMs: 1, kind: 'select' })
if (configuredCalls !== 2 || persistentCalls !== 2)
  throw new Error('Removing a persistent hook should preserve configured hooks')

setConfig({ hooks: undefined })
if (config.hooks !== undefined)
  throw new Error('Clearing configured hooks should restore the upstream fast path')

console.log('query-hook-lifecycle-ok')
