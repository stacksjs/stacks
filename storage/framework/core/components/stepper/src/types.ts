export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
export type Theme = 'light' | 'dark' | 'system'

export interface OptionParams {
  prefix?: string
}
export interface StepperProps {
  modelValue?: number
  id?: string
  steps?: number
  linear?: boolean
  persist?: boolean
  storekeeper?: string
  withDivider?: boolean
  debug?: boolean
}
