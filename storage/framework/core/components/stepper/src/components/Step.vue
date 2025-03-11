<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'Step',
})

interface Props {
  index: number
  title: string
  subtitle?: string
  description?: string
  status: 'upcoming' | 'current' | 'completed' | 'error'
  isLastStep: boolean
  orientation?: 'horizontal' | 'vertical'
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  subtitle: '',
  icon: '',
  orientation: 'vertical',
})

const emit = defineEmits<{
  select: [index: number]
}>()

const stepClasses = computed(() => ({
  'step-completed': props.status === 'completed',
  'step-current': props.status === 'current',
  'step-error': props.status === 'error',
}))

const iconClasses = computed(() => ({
  'bg-primary-100 text-primary-600': props.status === 'completed',
  'bg-gray-100 text-gray-600': props.status === 'current',
  'bg-gray-50 text-gray-400': props.status === 'upcoming',
  'bg-error-50 text-error-600': props.status === 'error',
}))

const lineClasses = computed(() => ({
  'bg-primary-600': props.status === 'completed',
  'bg-gray-200': props.status !== 'completed',
}))

const handleClick = () => {
  if (props.status !== 'upcoming') {
    emit('select', props.index)
  }
}

const getStepIcon = computed(() => {
  if (props.status === 'completed') return 'i-heroicons-check'
  switch (props.index) {
    case 0: return 'i-heroicons-user'
    case 1: return 'i-heroicons-identification'
    case 2: return 'i-heroicons-document-text'
    case 3: return 'i-heroicons-check-badge'
    default: return props.icon || `i-heroicons-${props.index + 1}-circle`
  }
})
</script>

<template>
  <div
    :class="[
      'step relative flex',
      props.orientation === 'vertical' ? 'items-start space-x-4' : 'flex-col items-center space-y-4',
      stepClasses
    ]"
    :data-orientation="props.orientation"
    @click="handleClick"
  >
    <!-- Step Icon Container -->
    <div
      class="relative"
      :class="[
        props.orientation === 'vertical' ? 'flex flex-col items-center' : 'flex items-center justify-center'
      ]"
    >
      <div
        :class="[
          'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 relative z-10',
          iconClasses,
          props.status !== 'upcoming' ? 'cursor-pointer hover:scale-110' : ''
        ]"
      >
        <div
          :class="[
            getStepIcon,
            'h-5 w-5'
          ]"
        />
      </div>

      <!-- Connector Line -->
      <div
        v-if="!props.isLastStep"
        :class="[
          props.orientation === 'vertical'
            ? 'absolute top-9 left-1/2 h-[calc(100%+1rem)] w-0.5 -translate-x-1/2'
            : 'absolute left-[calc(100%+0.25rem)] top-1/2 w-[calc(100%+2rem)] h-0.5 -translate-y-1/2',
          lineClasses,
          'transition-all duration-300'
        ]"
      />
    </div>

    <!-- Content -->
    <div
      class="flex min-h-[40px] pt-1"
      :class="[
        props.orientation === 'vertical' ? 'flex-col pb-8' : 'flex-col items-center pb-4 w-full'
      ]"
    >
      <!-- Title -->
      <span
        :class="[
          'text-sm font-medium',
          props.status === 'completed' ? 'text-gray-900' :
          props.status === 'current' ? 'text-gray-900' :
          props.status === 'error' ? 'text-error-600' : 'text-gray-500'
        ]"
      >
        {{ props.title }}
      </span>

      <!-- Description -->
      <span
        v-if="props.description"
        class="mt-1 text-sm text-gray-500"
        :class="[
          props.orientation === 'vertical' ? 'text-left' : 'text-center'
        ]"
      >
        {{ props.description }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.step {
  transition: all 0.3s ease;
  position: relative;
}

/* Horizontal layout specific styles */
.step[data-orientation="horizontal"] {
  flex: 1;
  min-width: 150px;
}

.step[data-orientation="horizontal"]:not(:last-child) {
  margin-right: 2rem;
}

.step-completed:hover {
  opacity: 0.9;
}

.step-current {
  transform: scale(1.02);
}

.step-error {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* Add smooth transitions */
.step :deep(*) {
  transition: all 0.3s ease;
}
</style>
