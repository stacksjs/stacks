```vue
<script setup>
import { ref, computed } from '@stacksjs/stx'
import { Stepper } from '@stacksjs/stepper'

const currentStep = ref(0)
const stepperRef = ref()

const steps = [
  {
    title: 'Step 1',
    description: 'First step',
    icon: 'i-heroicons-check'
  },
  {
    title: 'Step 2',
    description: 'Second step',
    icon: 'i-heroicons-check'
  },
  {
    title: 'Step 3',
    description: 'Third step',
    icon: 'i-heroicons-check'
  }
]

const next = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

const previous = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const reset = () => {
  currentStep.value = 0
}

const currentContent = computed(() => {
  switch (currentStep.value) {
    case 0:
      return {
        title: 'Personal Information',
        description: 'Please provide your basic details'
      }
    case 1:
      return {
        title: 'Account Setup',
        description: 'Configure your account settings'
      }
    case 2:
      return {
        title: 'Final Review',
        description: 'Review your information before submitting'
      }
    default:
      return {
        title: '',
        description: ''
      }
  }
})
</script>

<template>
  <div class="mx-auto p-8 max-w-3xl">
    <Stepper
      ref="stepperRef"
      v-model="currentStep"
      :steps="steps"
      orientation="horizontal"
      class="mb-12"
    />

    <!-- Content Section -->
    <div class="mb-8 p-6 bg-white ring-1 ring-gray-900/5 rounded-lg shadow-sm">
      <h2 class="mb-2 font-semibold text-gray-900 text-xl">
        {{ currentContent.title }}
      </h2>
      <p class="mb-6 text-gray-600">
        {{ currentContent.description }}
      </p>

      <!-- Step 1 Content -->
      <div v-if="currentStep === 0" class="space-y-4">
        <div class="grid gap-4 grid-cols-2">
          <div class="space-y-2">
            <label class="block font-medium text-gray-700 text-sm">First Name</label>
            <input type="text" class="block w-full sm:text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 shadow-sm" />
          </div>
          <div class="space-y-2">
            <label class="block font-medium text-gray-700 text-sm">Last Name</label>
            <input type="text" class="block w-full sm:text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 shadow-sm" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="block font-medium text-gray-700 text-sm">Email</label>
          <input type="email" class="block w-full sm:text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 shadow-sm" />
        </div>
      </div>

      <!-- Step 2 Content -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div class="space-y-2">
          <label class="block font-medium text-gray-700 text-sm">Username</label>
          <input type="text" class="block w-full sm:text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 shadow-sm" />
        </div>
        <div class="space-y-2">
          <label class="block font-medium text-gray-700 text-sm">Password</label>
          <input type="password" class="block w-full sm:text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 shadow-sm" />
        </div>
      </div>

      <!-- Step 3 Content -->
      <div v-if="currentStep === 2" class="space-y-4">
        <div class="p-4 bg-gray-50 rounded-lg">
          <h3 class="mb-2 font-medium text-gray-900 text-sm">Review Your Information</h3>
          <p class="text-gray-600 text-sm">Please review all the information you've entered. Once you submit, you won't be able to make changes.</p>
        </div>
        <div class="flex items-center space-x-2">
          <input type="checkbox" class="text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
          <label class="text-gray-700 text-sm">I confirm that all the information provided is correct</label>
        </div>
      </div>
    </div>

    <div class="flex gap-4 justify-center">
      <button
        class="px-4 py-2 font-medium text-gray-700 text-sm bg-gray-50 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        :disabled="currentStep === 0"
        @click="previous"
      >
        Previous
      </button>
      <button
        class="px-4 py-2 font-medium text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        :disabled="currentStep === steps.length - 1"
        @click="next"
      >
        Next
      </button>
      <button
        class="px-4 py-2 font-medium text-gray-700 text-sm bg-white hover:bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        @click="reset"
      >
        Reset
      </button>
    </div>
  </div>
</template>

<style scoped>
:deep(.stepper) {
  --tw-primary-100: rgb(219 234 254);
  --tw-primary-600: rgb(37 99 235);
}

button {
  transition: all 0.2s ease;
}

button:not(:disabled):active {
  transform: scale(0.98);
}

:deep(.step) {
  min-width: 120px;
}

:deep(.step[data-orientation="horizontal"]:not(:last-child)) {
  margin-right: 1rem;
}

:deep(.step-completed .connector-line) {
  @apply bg-blue-500;
}

:deep(.step-current) {
  @apply text-blue-600;
}

:deep(.step-completed) {
  @apply text-blue-600;
}

:deep(.step-icon) {
  @apply h-8 w-8 rounded-full flex items-center justify-center;
}

:deep(.step-completed .step-icon) {
  @apply bg-blue-100 text-blue-600;
}

:deep(.step-current .step-icon) {
  @apply bg-blue-100 text-blue-600 ring-2 ring-blue-600 ring-offset-2;
}

:deep(.step-upcoming .step-icon) {
  @apply bg-gray-100 text-gray-500;
}

input[type="text"],
input[type="email"],
input[type="password"] {
  @apply border-gray-300;
}

input[type="checkbox"] {
  @apply rounded border-gray-300 text-blue-600 focus:ring-blue-500;
}
</style>
```
