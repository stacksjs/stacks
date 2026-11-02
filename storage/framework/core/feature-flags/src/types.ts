export type FeatureScalar = boolean | string | number | null

export type FeatureValue =
  | FeatureScalar
  | { [key: string]: FeatureValue }
  | FeatureValue[]

export type FeatureScope = unknown

export interface FeatureScopeKeyProvider {
  featureFlagScope: string | number | (() => string | number)
  featureFlagType?: string | (() => string)
}

export interface FeatureContext<Scope = FeatureScope> {
  name: string
  scope: Scope
  scopeKey: string
}

export type FeatureResolver<Scope = FeatureScope> = (
  scope: Scope,
  context: FeatureContext<Scope>,
) => FeatureValue | Promise<FeatureValue>

export type FeatureDefinition<Scope = FeatureScope> = FeatureValue | FeatureResolver<Scope>

export type FeatureEvaluationSource = 'stored' | 'resolver' | 'missing'

export interface FeatureEvaluation<Scope = FeatureScope> extends FeatureContext<Scope> {
  value: FeatureValue
  source: FeatureEvaluationSource
}

export interface FeatureDriver {
  get: (name: string, scopeKey: string) => Promise<FeatureValue | undefined>
  set: (name: string, scopeKey: string, value: FeatureValue) => Promise<void>
  /**
   * Store `value` unless one is already stored, and return the stored value.
   * A first resolution goes through it, so two processes resolving the same
   * scope at once keep the same answer. Optional: without it the manager
   * uses `set`, and the later of two racing resolutions wins.
   */
  add?: (name: string, scopeKey: string, value: FeatureValue) => Promise<FeatureValue>
  delete: (name: string, scopeKey: string) => Promise<void>
  deleteForAllScopes: (names?: readonly string[]) => Promise<void>
  clear: () => Promise<void>
  stored: (scopeKey: string) => Promise<Record<string, FeatureValue>>
}

export type FeatureDriverFactory = () => FeatureDriver | Promise<FeatureDriver>

export interface FeatureFlagManagerOptions {
  driver?: FeatureDriver | FeatureDriverFactory
  missing?: 'false' | 'throw'
  scopeResolver?: (scope: FeatureScope) => string
}

export interface DatabaseFeatureFlagDriverOptions {
  table?: string
  autoCreate?: boolean
  dialect?: 'sqlite' | 'mysql' | 'postgres'
}

export interface FeatureDatabaseClient {
  selectFrom: (table: string) => any
  insertInto: (table: string) => any
  updateTable: (table: string) => any
  deleteFrom: (table: string) => any
  unsafe?: (sql: string) => any
}
