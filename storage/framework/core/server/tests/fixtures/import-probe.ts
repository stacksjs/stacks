const implementationKey = Symbol.for('@stacksjs/logging:implementation-loaded')

const before = (globalThis as Record<symbol, unknown>)[implementationKey] === true
await import('../../src/index')
const routerRootLoaded = Object.keys(import.meta.require.cache).some(modulePath =>
  /\/core\/router\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
)

console.log(JSON.stringify({
  before,
  after: (globalThis as Record<symbol, unknown>)[implementationKey] === true,
  routerRootLoaded,
}))
