export { GlobalRegistrator } from '@happy-dom/global-registrator'

export function enableBrowserFeatures() {
  return GlobalRegistrator.register()
}

export function setupTestEnvironment() {
  process.env.NODE_ENV = 'test'
  process.env.APP_ENV = 'test'
  return GlobalRegistrator.register()
}
