import type { FeatureFlagsConfig } from '@stacksjs/types'
import { defineFeatureFlags } from '@stacksjs/config'

export default defineFeatureFlags({
  default: 'memory',
  missing: 'false',
  drivers: {
    memory: {
      cloneValues: true,
    },
    database: {
      table: 'feature_flags',
      autoCreate: false,
    },
  },
}) satisfies FeatureFlagsConfig
