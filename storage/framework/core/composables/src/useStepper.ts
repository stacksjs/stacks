import type { Ref } from '@stacksjs/stx'
import { computed, ref } from '@stacksjs/stx'

export interface UseStepperReturn<T> {
  steps: Ref<T[]>
  current: Ref<T>
  index: Ref<number>
  isFirst: Ref<boolean>
  isLast: Ref<boolean>
  next: () => void
  previous: () => void
  goTo: (step: T) => void
  goToIndex: (index: number) => void
  isBefore: (step: T) => boolean
  isAfter: (step: T) => boolean
  isCurrent: (step: T) => boolean
}

/**
 * Step-by-step navigation composable.
 * Provides reactive state and controls for stepping through an ordered list.
 *
 * @param steps - Array of step values
 * @param initialStep - Optional initial step (defaults to first step)
 */
export function useStepper<T>(steps: T[], initialStep?: T): UseStepperReturn<T> {
  const stepsRef = ref<T[]>([...steps]) as Ref<T[]>

  const initialIndex = initialStep !== undefined ? steps.indexOf(initialStep) : 0
  const index = ref<number>(initialIndex >= 0 ? initialIndex : 0)

  const current = computed<T>(() => stepsRef.value[index.value])
  const isFirst = computed<boolean>(() => index.value === 0)
  const isLast = computed<boolean>(() => index.value === stepsRef.value.length - 1)

  function next(): void {
    if (index.value < stepsRef.value.length - 1) {
      index.value++
    }
  }

  function previous(): void {
    if (index.value > 0) {
      index.value--
    }
  }

  function goTo(step: T): void {
    const idx = stepsRef.value.indexOf(step)
    if (idx >= 0) {
      index.value = idx
    }
  }

  function goToIndex(idx: number): void {
    if (idx >= 0 && idx < stepsRef.value.length) {
      index.value = idx
    }
  }

  function isBefore(step: T): boolean {
    const stepIndex = stepsRef.value.indexOf(step)
    return stepIndex >= 0 && index.value < stepIndex
  }

  function isAfter(step: T): boolean {
    const stepIndex = stepsRef.value.indexOf(step)
    return stepIndex >= 0 && index.value > stepIndex
  }

  function isCurrent(step: T): boolean {
    return stepsRef.value[index.value] === step
  }

  return {
    steps: stepsRef,
    current,
    index,
    isFirst,
    isLast,
    next,
    previous,
    goTo,
    goToIndex,
    isBefore,
    isAfter,
    isCurrent,
  }
}
