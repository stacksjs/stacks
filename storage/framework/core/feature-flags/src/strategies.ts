import type { FeatureResolver } from './types'

function assertPercentage(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new RangeError(`Percentage must be between 0 and 100. Received ${value}.`)
}

/** Stable FNV-1a hash normalized to the half-open range [0, 100). */
export function featureBucket(input: string): number {
  const bytes = new TextEncoder().encode(input)
  let hash = 0x811C9DC5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000 * 100
}

/** Deterministically activate a percentage of scopes for a flag. */
export function percentage(percent: number): FeatureResolver {
  assertPercentage(percent)
  return (_scope, context) => featureBucket(`${context.name}\0${context.scopeKey}`) < percent
}

/** Deterministically assign every scope to one weighted variant. */
export function variants<const Name extends string>(weights: Record<Name, number>): FeatureResolver<unknown> {
  const entries = Object.entries(weights) as Array<[Name, number]>
  if (entries.length === 0) throw new RangeError('At least one feature variant is required.')
  let total = 0
  for (const [name, weight] of entries) {
    if (!Number.isFinite(weight) || weight <= 0)
      throw new RangeError(`Variant '${name}' must have a positive, finite weight.`)
    total += weight
  }

  return (_scope, context) => {
    const target = featureBucket(`${context.name}\0${context.scopeKey}`) / 100 * total
    let cursor = 0
    for (const [name, weight] of entries) {
      cursor += weight
      if (target < cursor) return name
    }
    return entries[entries.length - 1][0]
  }
}
