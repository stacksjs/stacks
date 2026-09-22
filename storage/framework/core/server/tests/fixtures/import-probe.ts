const implementationKey = Symbol.for('@stacksjs/logging:implementation-loaded')

const before = (globalThis as Record<symbol, unknown>)[implementationKey] === true
await import('../../src/index')

console.log(JSON.stringify({
  before,
  after: (globalThis as Record<symbol, unknown>)[implementationKey] === true,
}))
