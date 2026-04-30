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

export interface ScaleConfig {
  beginAtZero?: boolean
  display?: boolean
  stacked?: boolean
  grid?: { display?: boolean, color?: string, drawBorder?: boolean }
  ticks?: {
    color?: string
    font?: { size?: number, family?: string }
    callback?: (value: number, index: number, ticks: any[]) => string
    stepSize?: number
    maxTicksLimit?: number
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
