import type { FeatureFlagsConfig } from '@stacksjs/types'
import type { FeatureDriver } from './types'
import { DatabaseFeatureFlagDriver } from './drivers/database'
import { MemoryFeatureFlagDriver } from './drivers/memory'
import { FeatureFlagStoreError } from './errors'
import { FeatureFlagManager } from './manager'

export * from './drivers'
export * from './errors'
export * from './manager'
export * from './schema'
export * from './scope'
export * from './strategies'
export * from './types'
export * from './value'

async function configuredDriver(
  config: FeatureFlagsConfig,
  dialect: string | undefined,
): Promise<FeatureDriver> {
  if (config.default === 'database') {
    if (dialect !== 'sqlite' && dialect !== 'mysql' && dialect !== 'singlestore' && dialect !== 'postgres')
      throw new FeatureFlagStoreError(`The feature flag database driver requires a SQL database. Received '${dialect ?? 'undefined'}'.`)
    const { db } = await import('@stacksjs/database')
    return new DatabaseFeatureFlagDriver(db, {
      ...config.drivers?.database,
      dialect: dialect === 'mysql' || dialect === 'singlestore'
        ? 'mysql'
        : dialect === 'postgres'
          ? 'postgres'
        : 'sqlite',
    })
  }
  return new MemoryFeatureFlagDriver(config.drivers?.memory)
}

/**
 * Global, configuration-aware feature facade.
 *
 * The config and database imports stay lazy so defining flags at application
 * boot cannot create a config/database module cycle.
 */
export const Feature = new FeatureFlagManager({
  driver: async () => {
    const { awaitConfig } = await import('@stacksjs/config')
    const config = await awaitConfig()
    Feature.missing(config.featureFlags.missing ?? 'false')
    return configuredDriver(config.featureFlags, config.database.default)
  },
})

export const featureFlags = Feature
