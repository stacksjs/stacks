<script setup lang="ts">
import { ref, computed } from 'vue'
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
  <div class="p-8 max-w-3xl mx-auto">
    <Stepper
      ref="stepperRef"
      v-model="currentStep"
      :steps="steps"
      orientation="horizontal"
      class="mb-12"
    />

    <!-- Content Section -->
    <div class="mb-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ currentContent.title }}
      </h2>
      <p class="text-gray-600 mb-6">
        {{ currentContent.description }}
      </p>

      <!-- Step 1 Content -->
      <div v-if="currentStep === 0" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">First Name</label>
            <input type="text" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Last Name</label>
            <input type="text" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
        </div>
      </div>

      <!-- Step 2 Content -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Username</label>
          <input type="text" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input type="password" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
        </div>
      </div>

      <!-- Step 3 Content -->
      <div v-if="currentStep === 2" class="space-y-4">
        <div class="rounded-lg bg-gray-50 p-4">
          <h3 class="text-sm font-medium text-gray-900 mb-2">Review Your Information</h3>
          <p class="text-sm text-gray-600">Please review all the information you've entered. Once you submit, you won't be able to make changes.</p>
        </div>
        <div class="flex items-center space-x-2">
          <input type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <label class="text-sm text-gray-700">I confirm that all the information provided is correct</label>
        </div>
      </div>
    </div>

    <div class="flex justify-center gap-4">
      <button
        class="rounded-md bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        :disabled="currentStep === 0"
        @click="previous"
      >
        Previous
      </button>
      <button
        class="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        :disabled="currentStep === steps.length - 1"
        @click="next"
      >
        Next
      </button>
      <button
        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

