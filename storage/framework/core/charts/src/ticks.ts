import { format } from '@ts-charts/format'
import { scaleLinear } from '@ts-charts/scale'

/**
 * Compute "nice" tick values for a numeric range.
 *
 * Delegates to `@ts-charts/scale`'s `scaleLinear().nice().ticks()` so we
 * inherit the same 1/2/5×10ⁿ progression D3 has battle-tested for a decade.
 */
export function niceTicks(min: number, max: number, count: number = 8): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
    return [Number.isFinite(min) ? min : 0]

  const scale = scaleLinear().domain([min, max]).nice(count)
  const ticks = scale.ticks(count) as number[]
  if (ticks.length === 0)
    return [min, max]
  return ticks
}

const SI = format('~s')

/**
 * Format a tick value compactly. Uses ts-charts SI notation (`1.5k`, `2.5M`)
 * which is what the dashboards expect, falling back to integer/2dp for
 * values under 1000.
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value))
    return ''
  const abs = Math.abs(value)
  if (abs >= 1000)
    return SI(value).replace('G', 'B').toUpperCase()
  if (Number.isInteger(value))
    return value.toString()
  return value.toFixed(2)
}
