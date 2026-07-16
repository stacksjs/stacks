export class FeatureFlagError extends Error {
  override name = 'FeatureFlagError'
}

export class FeatureNotDefinedError extends FeatureFlagError {
  override name = 'FeatureNotDefinedError'

  constructor(feature: string) {
    super(`Feature flag '${feature}' has not been defined.`)
  }
}

export class InvalidFeatureValueError extends FeatureFlagError {
  override name = 'InvalidFeatureValueError'

  constructor(message: string) {
    super(`Feature values must be JSON-safe. ${message}`)
  }
}

export class InvalidFeatureScopeError extends FeatureFlagError {
  override name = 'InvalidFeatureScopeError'
}

export class FeatureFlagStoreError extends FeatureFlagError {
  override name = 'FeatureFlagStoreError'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}
