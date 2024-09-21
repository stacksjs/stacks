export { GlobalRegistrator } from '@happy-dom/global-registrator'

export function enableBrowserFeatures() {
  return GlobalRegistrator.register()
}
