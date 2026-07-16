import type { FeatureDriver, FeatureValue } from '../types'
import { normalizeFeatureValue } from '../value'

export interface MemoryFeatureFlagDriverOptions {
  cloneValues?: boolean
}

export class MemoryFeatureFlagDriver implements FeatureDriver {
  private readonly values = new Map<string, Map<string, FeatureValue>>()
  private readonly cloneValues: boolean

  constructor(options: MemoryFeatureFlagDriverOptions = {}) {
    this.cloneValues = options.cloneValues ?? true
  }

  private clone(value: FeatureValue): FeatureValue {
    return this.cloneValues ? normalizeFeatureValue(value) : value
  }

  async get(name: string, scopeKey: string): Promise<FeatureValue | undefined> {
    const value = this.values.get(scopeKey)?.get(name)
    return value === undefined ? undefined : this.clone(value)
  }

  async set(name: string, scopeKey: string, value: FeatureValue): Promise<void> {
    let scoped = this.values.get(scopeKey)
    if (!scoped) {
      scoped = new Map()
      this.values.set(scopeKey, scoped)
    }
    scoped.set(name, this.clone(value))
  }

  async delete(name: string, scopeKey: string): Promise<void> {
    const scoped = this.values.get(scopeKey)
    scoped?.delete(name)
    if (scoped?.size === 0) this.values.delete(scopeKey)
  }

  async deleteForAllScopes(names?: readonly string[]): Promise<void> {
    if (!names) {
      this.values.clear()
      return
    }
    const wanted = new Set(names)
    for (const [scopeKey, scoped] of this.values) {
      for (const name of wanted) scoped.delete(name)
      if (scoped.size === 0) this.values.delete(scopeKey)
    }
  }

  async clear(): Promise<void> {
    this.values.clear()
  }

  async stored(scopeKey: string): Promise<Record<string, FeatureValue>> {
    const result: Record<string, FeatureValue> = {}
    for (const [name, value] of this.values.get(scopeKey) ?? []) {
      Object.defineProperty(result, name, {
        value: this.clone(value),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  }
}

export function createMemoryFeatureFlagDriver(options?: MemoryFeatureFlagDriverOptions): MemoryFeatureFlagDriver {
  return new MemoryFeatureFlagDriver(options)
}
