export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
export type Theme = 'light' | 'dark' | 'system'
export type StepStatus = 'upcoming' | 'current' | 'completed' | 'error'
export type StepperOrientation = 'horizontal' | 'vertical'

export interface OptionParams {
  prefix?: string
}

export interface StepConfig {
  title: string
  description?: string
  validator?: () => Promise<boolean> | boolean
}

export interface StepperProps {
  id?: string
  steps: StepConfig[]
  orientation?: StepperOrientation
  allowSkip?: boolean
  showStepDescription?: boolean
  theme?: {
    primary?: string
    error?: string
  }
  linear?: boolean
  persist?: boolean
  storekeeper?: 'localStorage' | 'sessionStorage'
  withDivider?: boolean
  debug?: boolean
  loading?: boolean
  validateStep?: (stepIndex: number) => Promise<boolean> | boolean
  errorMessage?: string
}

export interface StepperInstance {
  next: () => Promise<void>
  previous: () => Promise<void>
  reset: () => void
  currentStep: number
  error: string | null
  isValidating: boolean
}

export interface StepProps {
  index: number
  title: string
  description?: string
  status: StepStatus
  isLastStep: boolean
  orientation?: StepperOrientation
}
