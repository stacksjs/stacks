<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
    if (currentStepConfig?.validator) {
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
      await handleStepSelect(currentStep.value + 1)
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
  <div class="relative flex justify-center w-full px-4 min-h-32">
    <div
      class="flex "
      :class="[
        isVertical ? 'flex-col space-y-0' : 'flex-row items-center justify-between'
      ]"
    >
      <div
        v-for="(step, index) in steps"
        :key="'step-'+index"
        class="flex-1"
        :class="[
          orientation === 'horizontal' ? 'mx-4' : ''
        ]"
      >
        <!-- Default Step Template -->
        <div
          v-if="!$slots.step"
          class="relative flex transition-all duration-300 ease-in-out"
          :class="[
            orientation === 'vertical' ? 'items-start gap-4' : 'flex-col items-center gap-4',
            orientation === 'horizontal' && index !== steps.length - 1 ? 'mr-8' : '',
            stepStatuses[index] === 'completed' ? 'hover:opacity-90 cursor-pointer' : '',
            stepStatuses[index] === 'current' ? 'scale-102' : '',
            stepStatuses[index] === 'error' ? 'animate-shake' : ''
          ]"
          @click="handleStepSelect(index)"
        >
          <!-- Step Icon Container -->
          <div class="relative flex"
            :class="[
              orientation === 'vertical' ? 'flex-col items-center' : ''
            ]"
          >
            <div
              class="relative z-10 flex items-center justify-center transition-all duration-200 ease-in-out border-2 rounded-full h-9 w-9"
              :class="{
                'bg-primary-600 border-primary-600 text-white': stepStatuses[index] === 'completed',
                'bg-white border-primary-600 text-primary-600': stepStatuses[index] === 'current',
                'bg-white border-gray-300 text-gray-400': stepStatuses[index] === 'upcoming',
                'bg-white border-error-600 text-error-600': stepStatuses[index] === 'error'
              }"
            >
              <div class="flex items-center justify-center w-5 h-5">
                <template v-if="stepStatuses[index] === 'completed'">
                  <div class="i-hugeicons-checkmark-circle-01" />
                </template>
                <template v-else>
                  {{ index + 1 }}
                </template>
              </div>
            </div>

            <!-- Connector Line -->
            <div
              v-if="index !== steps.length - 1"
              class="absolute transition-all duration-300 ease-in-out"
              :class="[
                orientation === 'vertical'
                  ? 'top-9 left-1/2 h-[calc(100%+1rem)] w-0.5 -translate-x-1/2'
                  : 'left-[calc(100%+0.25rem)] top-1/2 w-[calc(200%+0.2rem)] h-0.5 -translate-y-1/2',
                {
                  'bg-primary-600': stepStatuses[index] === 'completed',
                  'bg-gray-300': stepStatuses[index] !== 'completed'
                }
              ]"
            />
          </div>

          <!-- Content -->
          <div
            class="flex flex-col pt-1 min-h-10"
            :class="[
              orientation === 'vertical' ? 'pb-8' : 'items-center pb-4 w-full'
            ]"
          >
            <!-- Title -->
            <span
              class="text-sm font-medium"
              :class="{
                'text-gray-900': ['completed', 'current'].includes(stepStatuses[index] || ''),
                'text-error-600': stepStatuses[index] === 'error',
                'text-gray-400': stepStatuses[index] === 'upcoming'
              }"
            >
              {{ step.title }}
            </span>

            <!-- Description -->
            <span
              v-if="step.description"
              class="mt-1 text-sm text-gray-500"
              :class="[
                orientation === 'vertical' ? 'text-left' : 'text-center'
              ]"
            >
              {{ step.description }}
            </span>
          </div>
        </div>

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
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="error"
      class="absolute left-0 right-0 text-sm text-center transition-all duration-200 -bottom-6 text-error-600"
    >
      {{ error }}
    </div>

    <!-- Loading Indicator -->
    <div
      v-if="isValidating"
      class="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm"
    >
      <div class="w-8 h-8 border-4 rounded-full animate-spin border-primary-600 border-t-transparent" />
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.scale-102 {
  transform: scale(1.02);
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
</style>
