const runtime = await import('@stacksjs/env/runtime')
await import('@stacksjs/database/runtime')

const moduleCacheKeys = () => Object.keys(import.meta.require.cache)
const envRootLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/env\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
)
const runtimeSourceLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/env\/src\/runtime\.ts$/.test(modulePath),
)
const runtimeDistLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/env\/dist\/runtime\.js$/.test(modulePath),
)
const databaseRuntimeSourceLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/database\/src\/runtime\.ts$/.test(modulePath),
)
const decryptionSupportLoaded = () => moduleCacheKeys().some(modulePath =>
  /\/core\/env\/src\/(?:crypto|parser|plaintext-env|plugin)\.ts$/.test(modulePath),
)

const rootLoadedBeforeRootImport = envRootLoaded()
const decryptionSupportLoadedBeforeRootImport = decryptionSupportLoaded()
const root = await import('@stacksjs/env')

console.log(JSON.stringify({
  rootLoadedBeforeRootImport,
  rootLoadedAfterRootImport: envRootLoaded(),
  runtimeSourceLoaded: runtimeSourceLoaded(),
  runtimeDistLoaded: runtimeDistLoaded(),
  databaseRuntimeSourceLoaded: databaseRuntimeSourceLoaded(),
  decryptionSupportLoadedBeforeRootImport,
  sameEnv: runtime.env === root.env,
  sameProcess: runtime.process === root.process,
  sameWriteEnv: runtime.writeEnv === root.writeEnv,
  sameValidateEnv: runtime.validateEnv === root.validateEnv,
  sameRequireEnv: runtime.requireEnv === root.requireEnv,
}))
