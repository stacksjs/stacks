import process from 'node:process'

const mode = process.argv[2]
const implementationKey = Symbol.for('@stacksjs/logging:implementation-loaded')
const configKey = Symbol.for('@stacksjs/config:overridesReady')

if (mode === 'resolved-info' || mode === 'replaced-debug' || mode === 'env-after-info')
  (globalThis as Record<symbol, unknown>)[configKey] = Promise.resolve({ logging: { level: 'info' } })
if (mode === 'resolved-debug')
  (globalThis as Record<symbol, unknown>)[configKey] = Promise.resolve({ logging: { level: 'debug' } })

const { log } = await import('../../src/runtime')
const before = (globalThis as Record<symbol, unknown>)[implementationKey] === true

if (mode === 'pending-info') {
  let resolveConfig!: (value: unknown) => void
  ;(globalThis as Record<symbol, unknown>)[configKey] = new Promise(resolve => resolveConfig = resolve)
  const completion = log.debug('suppressed after config resolves')
  resolveConfig({ logging: { level: 'info' } })
  await completion
}
else if (mode === 'replaced-debug') {
  await log.debug('suppressed by initial config')
  ;(globalThis as Record<symbol, unknown>)[configKey] = Promise.resolve({ logging: { level: 'debug' } })
  await log.debug('enabled by replacement config')
}
else if (mode === 'env-after-info') {
  await log.debug('suppressed by initial config')
  process.env.LOG_LEVEL = 'debug'
  await log.debug('enabled by runtime env change')
}
else if (mode === 'warn') {
  await log.warn('runtime facade warning')
}
else {
  await log.debug('runtime facade debug')
}

console.log(JSON.stringify({
  before,
  after: (globalThis as Record<symbol, unknown>)[implementationKey] === true,
}))
