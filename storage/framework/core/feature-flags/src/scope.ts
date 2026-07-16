import type { FeatureScope, FeatureScopeKeyProvider } from './types'
import { createHash } from 'node:crypto'
import { InvalidFeatureScopeError } from './errors'

function boundedScopeKey(value: string): string {
  if (new TextEncoder().encode(value).byteLength <= 512) return value
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function stableObject(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return { $bigint: value.toString() }
    if (typeof value === 'symbol' || typeof value === 'function' || value === undefined)
      throw new InvalidFeatureScopeError(`Feature scope contains unsupported value '${typeof value}'.`)
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new InvalidFeatureScopeError('Feature scope cannot contain NaN or Infinity.')
    return value
  }

  if (seen.has(value))
    throw new InvalidFeatureScopeError('Feature scope cannot contain circular references.')
  seen.add(value)

  try {
    if (value instanceof Date) return { $date: value.toISOString() }
    if (Array.isArray(value)) return value.map(item => stableObject(item, seen))
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      throw new InvalidFeatureScopeError('Feature scope objects must be plain objects or expose featureFlagScope.')

    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort())
      out[key] = stableObject((value as Record<string, unknown>)[key], seen)
    return out
  }
  finally {
    seen.delete(value)
  }
}

function providerValue(provider: FeatureScopeKeyProvider): string | number {
  return typeof provider.featureFlagScope === 'function'
    ? provider.featureFlagScope()
    : provider.featureFlagScope
}

function providerType(provider: FeatureScopeKeyProvider): string {
  const raw = typeof provider.featureFlagType === 'function'
    ? provider.featureFlagType()
    : provider.featureFlagType
  return raw?.trim() || provider.constructor?.name || 'object'
}

function inferredObjectType(object: Record<string, unknown>, scope: object): string {
  const explicit = typeof object.featureFlagType === 'function'
    ? (object.featureFlagType as () => unknown)()
    : object.featureFlagType
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()

  const definition = object._definition
  if (definition && typeof definition === 'object') {
    const name = (definition as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }

  return scope.constructor?.name || 'object'
}

/** Convert a scope into a stable, type-aware storage key. */
export function featureScopeKey(scope: FeatureScope): string {
  if (scope === null || scope === undefined) return 'global'
  if (typeof scope === 'string') return boundedScopeKey(`string:${scope}`)
  if (typeof scope === 'number') {
    if (!Number.isFinite(scope)) throw new InvalidFeatureScopeError('Feature scope cannot be NaN or Infinity.')
    return `number:${scope}`
  }
  if (typeof scope === 'bigint') return `bigint:${scope}`
  if (typeof scope === 'boolean') return `boolean:${scope}`
  if (typeof scope === 'symbol' || typeof scope === 'function')
    throw new InvalidFeatureScopeError(`Feature scope of type '${typeof scope}' is not supported.`)

  const object = scope as Record<string, unknown>
  if ('featureFlagScope' in object) {
    const provider = object as unknown as FeatureScopeKeyProvider
    const id = providerValue(provider)
    if ((typeof id !== 'string' && typeof id !== 'number') || String(id).length === 0)
      throw new InvalidFeatureScopeError('featureFlagScope must resolve to a non-empty string or number.')
    return boundedScopeKey(`model:${providerType(provider)}:${String(id)}`)
  }

  if ('id' in object && (typeof object.id === 'string' || typeof object.id === 'number')) {
    const type = inferredObjectType(object, scope)
    return boundedScopeKey(`model:${type}:${String(object.id)}`)
  }

  return boundedScopeKey(`object:${JSON.stringify(stableObject(scope, new WeakSet()))}`)
}
