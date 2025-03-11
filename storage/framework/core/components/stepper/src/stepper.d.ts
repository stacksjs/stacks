declare module '@stacksjs/stepper' {
  import type { Component, Plugin } from 'vue'

  export interface StepperInstance {
    next: () => void
    previous: () => void
    reset: () => void
  }

  export interface StepperProps {
    id?: string
    steps: number
    linear?: boolean
    persist?: boolean
    storekeeper?: 'localStorage' | 'sessionStorage'
    withDivider?: boolean
    debug?: boolean
    loading?: boolean
    validateStep?: (stepIndex: number) => Promise<boolean> | boolean
    errorMessage?: string
  }

  export interface OptionParams {
    prefix?: string
  }

  export const Stepper: Component
  export const Step: Component
  export const StepperStep: Component

  const plugin: Plugin
  export default plugin
}
