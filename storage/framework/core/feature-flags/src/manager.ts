import type {
  FeatureDefinition,
  FeatureDriver,
  FeatureDriverFactory,
  FeatureEvaluation,
  FeatureFlagManagerOptions,
  FeatureResolver,
  FeatureScope,
  FeatureValue,
} from './types'
import { FeatureNotDefinedError } from './errors'
import { MemoryFeatureFlagDriver } from './drivers/memory'
import { featureScopeKey } from './scope'
import { normalizeFeatureValue } from './value'

type EvaluationListener = (evaluation: FeatureEvaluation) => void | Promise<void>

function featureName(name: string): string {
  if (typeof name !== 'string' || name.trim().length === 0)
    throw new TypeError('Feature flag names must be non-empty strings.')
  if (name !== name.trim())
    throw new TypeError('Feature flag names cannot start or end with whitespace.')
  if (new TextEncoder().encode(name).byteLength > 191)
    throw new TypeError('Feature flag names cannot exceed 191 UTF-8 bytes.')
  return name
}

function evaluationKey(name: string, scopeKey: string): string {
  return JSON.stringify([name, scopeKey])
}

function prepareDefinition(definition: FeatureDefinition): FeatureDefinition {
  return typeof definition === 'function' ? definition : normalizeFeatureValue(definition)
}

function setResult(result: Record<string, FeatureValue>, name: string, value: FeatureValue): void {
  Object.defineProperty(result, name, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}

export class ScopedFeatureFlags<Scope = FeatureScope> {
  constructor(
    private readonly manager: FeatureFlagManager,
    readonly scope: Scope,
  ) {}

  value(name: string): Promise<FeatureValue> {
    return this.manager.value(name, this.scope)
  }

  values(names: readonly string[]): Promise<Record<string, FeatureValue>> {
    return this.manager.values(names, this.scope)
  }

  all(): Promise<Record<string, FeatureValue>> {
    return this.manager.all(this.scope)
  }

  active(name: string): Promise<boolean> {
    return this.manager.active(name, this.scope)
  }

  inactive(name: string): Promise<boolean> {
    return this.manager.inactive(name, this.scope)
  }

  activate(name: string, value: FeatureValue = true): Promise<void> {
    return this.manager.activate(name, value, this.scope)
  }

  deactivate(name: string): Promise<void> {
    return this.manager.deactivate(name, this.scope)
  }

  forget(name: string): Promise<void> {
    return this.manager.forget(name, this.scope)
  }

  when<Active, Inactive = undefined>(
    name: string,
    onActive: (value: FeatureValue) => Active | Promise<Active>,
    onInactive?: (value: FeatureValue) => Inactive | Promise<Inactive>,
  ): Promise<Active | Inactive | undefined> {
    return this.manager.when(name, onActive, onInactive, this.scope)
  }

  unless<Inactive, Active = undefined>(
    name: string,
    onInactive: (value: FeatureValue) => Inactive | Promise<Inactive>,
    onActive?: (value: FeatureValue) => Active | Promise<Active>,
  ): Promise<Inactive | Active | undefined> {
    return this.manager.unless(name, onInactive, onActive, this.scope)
  }
}

export class FeatureFlagManager {
  private readonly definitions = new Map<string, FeatureDefinition>()
  private readonly pending = new Map<string, Promise<FeatureValue>>()
  private readonly listeners = new Set<EvaluationListener>()
  private readonly resolveScope: (scope: FeatureScope) => string
  private driverSource: FeatureDriver | FeatureDriverFactory
  private driverPromise?: Promise<FeatureDriver>
  private missingBehavior: 'false' | 'throw'

  constructor(options: FeatureFlagManagerOptions = {}) {
    this.driverSource = options.driver ?? new MemoryFeatureFlagDriver()
    this.missingBehavior = options.missing ?? 'false'
    this.resolveScope = options.scopeResolver ?? featureScopeKey
  }

  /** Replace the storage driver. Existing definitions are retained. */
  use(driver: FeatureDriver | FeatureDriverFactory): this {
    this.driverSource = driver
    this.driverPromise = undefined
    this.pending.clear()
    return this
  }

  missing(behavior: 'false' | 'throw'): this {
    this.missingBehavior = behavior
    return this
  }

  define<Scope = FeatureScope>(name: string, definition: FeatureDefinition<Scope>): this
  define(definitions: Record<string, FeatureDefinition>): this
  define<Scope = FeatureScope>(
    nameOrDefinitions: string | Record<string, FeatureDefinition>,
    definition?: FeatureDefinition<Scope>,
  ): this {
    if (typeof nameOrDefinitions === 'string') {
      if (definition === undefined)
        throw new TypeError(`A definition is required for feature '${nameOrDefinitions}'.`)
      this.definitions.set(featureName(nameOrDefinitions), prepareDefinition(definition as FeatureDefinition))
      return this
    }

    for (const [name, value] of Object.entries(nameOrDefinitions))
      this.definitions.set(featureName(name), prepareDefinition(value))
    return this
  }

  defined(name: string): boolean {
    return this.definitions.has(featureName(name))
  }

  definedNames(): string[] {
    return [...this.definitions.keys()]
  }

  clearDefinitions(): this {
    this.definitions.clear()
    return this
  }

  for<Scope>(scope: Scope): ScopedFeatureFlags<Scope> {
    return new ScopedFeatureFlags(this, scope)
  }

  async value(name: string, scope: FeatureScope = null): Promise<FeatureValue> {
    const normalizedName = featureName(name)
    const scopeKey = this.resolveScope(scope)
    const key = evaluationKey(normalizedName, scopeKey)
    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight

    const evaluation = this.evaluate(normalizedName, scope, scopeKey)
    this.pending.set(key, evaluation)
    try {
      return await evaluation
    }
    finally {
      if (this.pending.get(key) === evaluation) this.pending.delete(key)
    }
  }

  private async evaluate(name: string, scope: FeatureScope, scopeKey: string): Promise<FeatureValue> {
    const driver = await this.driver()
    const stored = await driver.get(name, scopeKey)
    if (stored !== undefined) {
      const value = normalizeFeatureValue(stored)
      await this.notify({ name, scope, scopeKey, value, source: 'stored' })
      return value
    }

    const definition = this.definitions.get(name)
    if (definition === undefined) {
      if (this.missingBehavior === 'throw') throw new FeatureNotDefinedError(name)
      const value = false
      await this.notify({ name, scope, scopeKey, value, source: 'missing' })
      return value
    }

    const resolved = typeof definition === 'function'
      ? await (definition as FeatureResolver)(scope, { name, scope, scopeKey })
      : definition
    const value = normalizeFeatureValue(resolved)
    await driver.set(name, scopeKey, value)
    await this.notify({ name, scope, scopeKey, value, source: 'resolver' })
    return value
  }

  async values(names: readonly string[], scope: FeatureScope = null): Promise<Record<string, FeatureValue>> {
    const unique = [...new Set(names.map(featureName))]
    const pairs = await Promise.all(unique.map(async name => [name, await this.value(name, scope)] as const))
    return Object.fromEntries(pairs)
  }

  async all(scope: FeatureScope = null): Promise<Record<string, FeatureValue>> {
    const scopeKey = this.resolveScope(scope)
    const stored = await (await this.driver()).stored(scopeKey)
    const result: Record<string, FeatureValue> = {}
    for (const [name, value] of Object.entries(stored)) setResult(result, name, normalizeFeatureValue(value))
    for (const name of this.definitions.keys()) {
      if (!Object.hasOwn(result, name)) setResult(result, name, await this.value(name, scope))
    }
    return result
  }

  async active(name: string, scope: FeatureScope = null): Promise<boolean> {
    return Boolean(await this.value(name, scope))
  }

  async inactive(name: string, scope: FeatureScope = null): Promise<boolean> {
    return !(await this.active(name, scope))
  }

  async activate(name: string, value: FeatureValue = true, scope: FeatureScope = null): Promise<void> {
    const normalizedName = featureName(name)
    const scopeKey = this.resolveScope(scope)
    await this.awaitPending(normalizedName, scopeKey)
    await (await this.driver()).set(normalizedName, scopeKey, normalizeFeatureValue(value))
  }

  deactivate(name: string, scope: FeatureScope = null): Promise<void> {
    return this.activate(name, false, scope)
  }

  async forget(name: string, scope: FeatureScope = null): Promise<void> {
    const normalizedName = featureName(name)
    const scopeKey = this.resolveScope(scope)
    await this.awaitPending(normalizedName, scopeKey)
    await (await this.driver()).delete(normalizedName, scopeKey)
  }

  async purge(names?: string | readonly string[]): Promise<void> {
    const normalized = names === undefined
      ? undefined
      : (Array.isArray(names) ? names : [names]).map(featureName)
    await Promise.allSettled(this.pending.values())
    await (await this.driver()).deleteForAllScopes(normalized)
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.pending.values())
    await (await this.driver()).clear()
  }

  async when<Active, Inactive = undefined>(
    name: string,
    onActive: (value: FeatureValue) => Active | Promise<Active>,
    onInactive?: (value: FeatureValue) => Inactive | Promise<Inactive>,
    scope: FeatureScope = null,
  ): Promise<Active | Inactive | undefined> {
    const value = await this.value(name, scope)
    return Boolean(value) ? onActive(value) : onInactive?.(value)
  }

  async unless<Inactive, Active = undefined>(
    name: string,
    onInactive: (value: FeatureValue) => Inactive | Promise<Inactive>,
    onActive?: (value: FeatureValue) => Active | Promise<Active>,
    scope: FeatureScope = null,
  ): Promise<Inactive | Active | undefined> {
    const value = await this.value(name, scope)
    return Boolean(value) ? onActive?.(value) : onInactive(value)
  }

  onEvaluated(listener: EvaluationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async notify(evaluation: FeatureEvaluation): Promise<void> {
    await Promise.allSettled([...this.listeners].map(listener => Promise.resolve().then(() => listener(evaluation))))
  }

  private async awaitPending(name: string, scopeKey: string): Promise<void> {
    const pending = this.pending.get(evaluationKey(name, scopeKey))
    if (pending) {
      try {
        await pending
      }
      catch {
        // An explicit operator override must still work when evaluation fails.
      }
    }
  }

  private driver(): Promise<FeatureDriver> {
    if (!this.driverPromise) {
      const promise = Promise.resolve(
        typeof this.driverSource === 'function' ? this.driverSource() : this.driverSource,
      )
      this.driverPromise = promise
      void promise.catch(() => {
        if (this.driverPromise === promise) this.driverPromise = undefined
      })
    }
    return this.driverPromise
  }
}

export function createFeatureFlags(options?: FeatureFlagManagerOptions): FeatureFlagManager {
  return new FeatureFlagManager(options)
}
