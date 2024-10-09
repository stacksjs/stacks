import process from 'node:process'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

export function enableBrowserFeatures(): void {
  GlobalRegistrator.register()
}

export function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test'
  process.env.APP_ENV = 'test'

  GlobalRegistrator.register()
}

export { GlobalRegistrator }
