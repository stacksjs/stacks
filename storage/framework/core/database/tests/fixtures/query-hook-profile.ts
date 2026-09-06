import { config as queryBuilderConfig } from 'bun-query-builder'
import { initializeDbConfig } from '../../src/utils'

function initialize(appEnv: string, enabled: boolean): void {
  initializeDbConfig({
    app: { env: appEnv },
    database: { queryLogging: { enabled } },
  })
}

initialize('production', false)
if (queryBuilderConfig.hooks !== undefined)
  throw new Error('Production without persistent logging should not install query hooks')

initialize('production', true)
if (typeof queryBuilderConfig.hooks?.onQueryEnd !== 'function')
  throw new Error('Explicit production query logging should install query hooks')

initialize('development', false)
if (typeof queryBuilderConfig.hooks?.onQueryEnd !== 'function')
  throw new Error('Development should retain request query diagnostics')

initialize('production', false)
if (queryBuilderConfig.hooks !== undefined)
  throw new Error('Returning to the production fast profile should remove query hooks')

console.log('query-hook-profile-ok')
