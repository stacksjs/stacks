import { format } from '@ts-charts/format'
import { scaleLinear as rawScaleLinear } from '@ts-charts/scale'

/**
 * Local shape for `scaleLinear()` so the chained `.domain().nice().ticks()`
 * call stays typed. ts-charts ships its scale .d.ts with the
 * `default` qualifier dropped (bun-plugin-dtsx bug), which makes
 * `scaleLinear()` look not-callable to `tsc`.
 */
interface ScaleLinearLike {
  (x: number): number
  domain(d: number[]): ScaleLinearLike
  range(r: number[]): ScaleLinearLike
  ticks(count?: number): number[]
  nice(count?: number): ScaleLinearLike
}
const scaleLinear = rawScaleLinear as unknown as () => ScaleLinearLike

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
  const ticks = scale.ticks(count)
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
