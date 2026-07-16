export type FeatureFlagDriverName = 'memory' | 'database'

export interface FeatureFlagMemoryDriverConfig {
  /** Clone values on reads and writes so callers cannot mutate stored state. */
  cloneValues?: boolean
}

export interface FeatureFlagDatabaseDriverConfig {
  /** Database table used for resolved feature values. */
  table?: string

  /** Create the package-owned table lazily. Disabled unless explicitly enabled. */
  autoCreate?: boolean
}

/** Configuration for the user-facing feature flag service. */
export interface FeatureFlagsConfig {
  /** Storage driver used by the global Feature facade. */
  default: FeatureFlagDriverName

  /** Behavior when a flag has neither a stored value nor a definition. */
  missing?: 'false' | 'throw'

  drivers?: {
    memory?: FeatureFlagMemoryDriverConfig
    database?: FeatureFlagDatabaseDriverConfig
  }
}
