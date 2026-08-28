export type ChartType = 'line' | 'bar' | 'doughnut' | 'pie' | 'radar'

export interface ChartDataset {
  label?: string
  data: number[]
  backgroundColor?: string | string[] | CanvasGradient
  borderColor?: string | string[] | CanvasGradient
  borderWidth?: number
  fill?: boolean
  tension?: number
  pointRadius?: number
  pointBackgroundColor?: string
  pointBorderColor?: string
  stack?: string
  yAxisID?: string
  type?: ChartType
}

export interface ChartData {
  labels?: string[]
  datasets: ChartDataset[]
}

/*
 * These describe the Chart.js configuration this package ACCEPTS, which is
 * wider than what it renders: the class deliberately treats what it has not
 * implemented as a no-op rather than a crash, so a dashboard can be written
 * against Chart.js and simply get less chrome here.
 *
 * So a key being declared below is not a promise that it draws - `drawBorder`
 * has been declared and inert from the start. It is a promise that passing it
 * is legal and harmless. Keys were being left out of these types on the
 * accident of which dashboard was written first, which made honest Chart.js
 * config a type error at four call sites.
 */
export interface ScaleConfig {
  beginAtZero?: boolean
  display?: boolean
  stacked?: boolean
  grid?: { display?: boolean, color?: string, drawBorder?: boolean, borderDash?: number[] }
  ticks?: {
    color?: string
    font?: { size?: number, family?: string }
    callback?: (value: number, index: number, ticks: any[]) => string
    stepSize?: number
    maxTicksLimit?: number
    /** Decimal places on a numeric tick. */
    precision?: number
    /** Degrees a label may rotate to fit. */
    maxRotation?: number
    minRotation?: number
    /** Drop labels rather than overlap them. */
    autoSkip?: boolean
    padding?: number
  }
  min?: number
  max?: number
  position?: 'left' | 'right' | 'top' | 'bottom'
  title?: { display?: boolean, text?: string, color?: string }
}

export interface LegendConfig {
  display?: boolean
  position?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  labels?: { color?: string, font?: { size?: number }, boxWidth?: number, padding?: number }
}

export interface TooltipCallbackContext {
  dataset: ChartDataset
  datasetIndex: number
  dataIndex: number
  parsed: { x?: number, y: number }
  raw: number
  label: string
  formattedValue: string
}

export interface TooltipConfig {
  enabled?: boolean
  mode?: 'index' | 'point' | 'nearest' | 'dataset'
  intersect?: boolean
  callbacks?: {
    label?: (ctx: TooltipCallbackContext) => string | string[]
    title?: (ctx: TooltipCallbackContext[]) => string | string[]
  }
  backgroundColor?: string
  titleColor?: string
  bodyColor?: string
  borderColor?: string
  borderWidth?: number
  padding?: number
}

export interface ChartOptions {
  responsive?: boolean
  maintainAspectRatio?: boolean
  cutout?: string | number
  interaction?: { mode?: 'index' | 'point' | 'nearest' | 'dataset', intersect?: boolean }
  scales?: Record<string, ScaleConfig>
  plugins?: {
    legend?: LegendConfig
    tooltip?: TooltipConfig
    title?: { display?: boolean, text?: string, color?: string, font?: { size?: number } }
  }
  animation?: false | { duration?: number }
  layout?: { padding?: number | { top?: number, right?: number, bottom?: number, left?: number } }
}

export interface ChartConfig {
  type: ChartType
  data: ChartData
  options?: ChartOptions
}

export type CanvasContext = HTMLCanvasElement | CanvasRenderingContext2D
