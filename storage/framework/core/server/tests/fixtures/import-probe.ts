const implementationKey = Symbol.for('@stacksjs/logging:implementation-loaded')
const mode = process.argv[2]

const before = (globalThis as Record<symbol, unknown>)[implementationKey] === true
const serverModule = await import('../../src/index')
const moduleCacheKeys = () => Object.keys(import.meta.require.cache)
const configRootLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/config\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
)
const configRuntimeLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/config\/(?:src|dist)\/runtime\.(?:ts|js)$/.test(modulePath),
)
const configRuntimeSourceLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/config\/src\/runtime\.ts$/.test(modulePath),
)
const configRuntimeDistLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/config\/dist\/runtime\.js$/.test(modulePath),
)
const eventsRootLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/events\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
)
const routerRootLoaded = Object.keys(import.meta.require.cache).some(modulePath =>
  /\/core\/router\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
)
const routerRuntimeLoaded = Object.keys(import.meta.require.cache).some(modulePath =>
  /\/core\/router\/(?:src|dist)\/runtime\.(?:ts|js)$/.test(modulePath),
)
const configRootLoadedBeforeCall = configRootLoaded()
const configRuntimeLoadedBeforeCall = configRuntimeLoaded()
const eventsRootLoadedBeforeCall = eventsRootLoaded()
let port: number | undefined
let portBeforeReady: number | undefined
let sameConfig: boolean | undefined
let sameDefaults: boolean | undefined
let sameGetConfig: boolean | undefined

if (mode === 'call-config' || mode === 'await-config') {
  portBeforeReady = serverModule.server({ type: 'api' }).port
  port = portBeforeReady

  if (mode === 'await-config') {
    const { overridesReady } = await import('@stacksjs/config/runtime')
    await overridesReady
    port = serverModule.server({ type: 'api' }).port
  }
}

if (mode === 'identity') {
  const rootConfig = await import('@stacksjs/config')
  const runtimeConfig = await import('@stacksjs/config/runtime')
  sameConfig = rootConfig.config === runtimeConfig.config
  sameDefaults = rootConfig.defaults === runtimeConfig.defaults
  sameGetConfig = rootConfig.getConfig === runtimeConfig.getConfig
}

console.log(JSON.stringify({
  before,
  after: (globalThis as Record<symbol, unknown>)[implementationKey] === true,
  routerRootLoaded,
  routerRuntimeLoaded,
  configRootLoadedBeforeCall,
  configRuntimeLoadedBeforeCall,
  configRuntimeSourceLoaded: configRuntimeSourceLoaded(),
  configRuntimeDistLoaded: configRuntimeDistLoaded(),
  eventsRootLoadedBeforeCall,
  configRootLoadedAfterCall: configRootLoaded(),
  configRuntimeLoadedAfterCall: configRuntimeLoaded(),
  eventsRootLoadedAfterCall: eventsRootLoaded(),
  port,
  portBeforeReady,
  sameConfig,
  sameDefaults,
  sameGetConfig,
}))
