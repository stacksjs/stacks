import type { FeatureValue } from './types'
import { InvalidFeatureValueError } from './errors'

/** Validate and detach a feature value so every driver has identical semantics. */
export function normalizeFeatureValue(value: unknown): FeatureValue {
  if (value === undefined)
    throw new InvalidFeatureValueError('Undefined is not a valid feature value.')

  if (typeof value === 'number' && !Number.isFinite(value))
    throw new InvalidFeatureValueError('NaN and Infinity are not valid feature values.')

  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol')
    throw new InvalidFeatureValueError(`Values of type '${typeof value}' are not supported.`)

  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined)
      throw new InvalidFeatureValueError('The value cannot be serialized.')
    return JSON.parse(serialized) as FeatureValue
  }
  catch (error) {
    if (error instanceof InvalidFeatureValueError) throw error
    throw new InvalidFeatureValueError(error instanceof Error ? error.message : String(error))
  }
}
