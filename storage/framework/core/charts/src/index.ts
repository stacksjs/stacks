import { Chart } from './chart'

export { Chart }
export default Chart
export { DEFAULT_PALETTE, paletteColor, withAlpha } from './colors'
export { formatTick, niceTicks } from './ticks'
export type {
  ChartConfig,
  ChartData,
  ChartDataset,
  ChartOptions,
  ChartType,
  LegendConfig,
  ScaleConfig,
  TooltipCallbackContext,
  TooltipConfig,
} from './types'

/**
 * Chart.js compatibility shim — `chart.js/auto` exposes a `registerables`
 * array used to opt-in to all chart types and plugins. We auto-register
 * everything by default, so the shim is intentionally empty; export it
 * so existing call sites that destructure `{ Chart, registerables }` and
 * call `Chart.register(...registerables)` keep working unchanged.
 */
export const registerables: unknown[] = []
