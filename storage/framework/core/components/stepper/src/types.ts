export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
export type Theme = 'light' | 'dark' | 'system'

export interface StepperValue {
  value: number
  id?: string
}

export interface StepperEmitValue {
  value: number
  id?: string
  queries: Record<string, boolean>
}

export interface OptionParams {
  prefix?: string
}

export interface StepperUtils {
  getSlotName: (suffix: string | undefined, displayIndex: string, options?: Partial<OptionParams>) => string
}

export interface StepperProps {
  value?: StepperValue
  steps?: number
  linear?: boolean
  persist?: boolean
  storekeeper?: string
  withDivider?: boolean
  debug?: boolean
}
