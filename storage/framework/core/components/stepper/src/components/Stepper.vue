<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Step from './Step.vue'

defineOptions({
  name: 'Stepper',
})

interface StepConfig {
  title: string
  subtitle?: string
  description?: string
  validator?: () => Promise<boolean> | boolean
}

interface Props {
  steps: StepConfig[]
  allowSkip?: boolean
  showStepDescription?: boolean
  showStepSubtitle?: boolean
  orientation?: 'horizontal' | 'vertical'
  theme?: {
    primary?: string
    error?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  allowSkip: false,
  showStepDescription: true,
  showStepSubtitle: true,
  orientation: 'vertical',
  theme: () => ({
    primary: 'primary',
    error: 'error'
  })
})

const currentStep = defineModel<number>({ default: 0 })
const stepStatuses = ref<Array<'upcoming' | 'current' | 'completed' | 'error'>>([])
const isValidating = ref(false)
const error = ref<string | null>(null)

// Initialize step statuses
watch(() => props.steps, () => {
  stepStatuses.value = props.steps.map((_, index) =>
    index === currentStep.value ? 'current' : 'upcoming'
  )
}, { immediate: true })

// Watch for current step changes
watch(currentStep, (newStep, oldStep) => {
  if (oldStep !== undefined) {
    stepStatuses.value[oldStep] = 'completed'
  }
  stepStatuses.value[newStep] = 'current'
  error.value = null
})

const canMoveToStep = computed(() => (targetStep: number) => {
  if (props.allowSkip) return true
  if (targetStep < currentStep.value) return true
  return targetStep === currentStep.value + 1
})

async function handleStepSelect(index: number) {
  if (!canMoveToStep.value(index)) return

  // If moving forward, validate current step first
  if (index > currentStep.value) {
    const currentStepConfig = props.steps[currentStep.value]
    if (currentStepConfig.validator) {
      isValidating.value = true
      error.value = null

      try {
        const isValid = await currentStepConfig.validator()
        if (!isValid) {
          stepStatuses.value[currentStep.value] = 'error'
          error.value = 'Validation failed'
          isValidating.value = false
          return
        }
      } catch (e) {
        stepStatuses.value[currentStep.value] = 'error'
        error.value = e instanceof Error ? e.message : 'An error occurred'
        isValidating.value = false
        return
      }
    }
  }

  currentStep.value = index
  isValidating.value = false
}

async function next() {
  if (currentStep.value < props.steps.length - 1) {
    try {
      console.log('Current step before:', currentStep.value)
      await handleStepSelect(currentStep.value + 1)
      console.log('Current step after:', currentStep.value)
    } catch (error) {
      console.error('Error in next:', error)
    }
  } else {
    console.log('Already at last step')
  }
}

async function previous() {
  if (currentStep.value > 0) {
    try {
      await handleStepSelect(currentStep.value - 1)
    } catch (error) {
      console.error('Error in previous:', error)
    }
  } else {
    console.log('Already at first step')
  }
}

function reset() {
  currentStep.value = 0
  stepStatuses.value = props.steps.map((_, index) =>
    index === 0 ? 'current' : 'upcoming'
  )
  error.value = null
}

const isVertical = computed(() => props.orientation === 'vertical')

defineExpose({
  next,
  previous,
  reset,
  currentStep,
  error,
  isValidating
})
</script>

<template>
  <div
    class="stepper relative px-4"
    :class="[
      isVertical ? 'flex flex-col space-y-0' : 'flex flex-row items-center justify-between w-full'
    ]"
  >
    <template v-for="(step, index) in steps" :key="index">
      <!-- Default Step Template -->
      <Step
        v-if="!$slots.step"
        :index="index"
        :title="step.title"
        :subtitle="showStepSubtitle ? step.subtitle : undefined"
        :description="showStepDescription ? step.description : undefined"
        :status="stepStatuses[index]"
        :is-last-step="index === steps.length - 1"
        :orientation="orientation"
        :data-orientation="orientation"
        :style="[
          orientation === 'horizontal' && index !== steps.length - 1
            ? { minWidth: '150px', flex: 1 }
            : null
        ]"
        @select="handleStepSelect"
      />

      <!-- Custom Step Template -->
      <slot
        v-else
        name="step"
        :step="step"
        :index="index"
        :status="stepStatuses[index]"
        :is-last-step="index === steps.length - 1"
        :is-vertical="isVertical"
        :select="() => handleStepSelect(index)"
      />
    </template>

    <!-- Error Message -->
    <div
      v-if="error"
      class="absolute -bottom-6 left-0 right-0 text-center text-sm text-error-600 transition-all duration-200"
    >
      {{ error }}
    </div>

    <!-- Loading Indicator -->
    <div
      v-if="isValidating"
      class="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm"
    >
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  width: 100%;
  min-height: 8rem;
}

/* Theme customization classes */
:deep(.step-completed) {
  --tw-primary-600: var(--stepper-primary-color, theme('colors.primary.600'));
}

:deep(.step-error) {
  --tw-error-600: var(--stepper-error-color, theme('colors.error.600'));
}

/* Horizontal layout adjustments */
:deep([data-orientation="horizontal"]) {
  flex: 1;
  min-width: 150px;
  position: relative;
}

:deep([data-orientation="horizontal"]:not(:last-child)) {
  margin-right: 2rem;
}
</style>
