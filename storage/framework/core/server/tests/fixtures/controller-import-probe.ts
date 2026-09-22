const controllerModule = await import('../../../../defaults/app/Controllers/ComingSoonController')
const moduleCacheKeys = Object.keys(import.meta.require.cache)
const frameworkModules = moduleCacheKeys.filter(modulePath =>
  /\/storage\/framework\/core\//.test(modulePath),
)
const serverModules = frameworkModules.filter(modulePath =>
  /\/core\/server\/(?:src|dist)\//.test(modulePath),
)

console.log(JSON.stringify({
  controllerName: controllerModule.default.name,
  frameworkModuleCount: frameworkModules.length,
  serverModuleCount: serverModules.length,
  serverRootLoaded: serverModules.some(modulePath =>
    /\/core\/server\/(?:src|dist)\/index\.(?:ts|js)$/.test(modulePath),
  ),
  baseSourceLoaded: serverModules.some(modulePath =>
    /\/core\/server\/src\/controllers\/base\.ts$/.test(modulePath),
  ),
  baseDistLoaded: serverModules.some(modulePath =>
    /\/core\/server\/dist\/controllers\/base\.js$/.test(modulePath),
  ),
}))
