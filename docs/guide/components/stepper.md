# Stepper

A modern, accessible stepper component for Vue applications.

<StepperDemo />

## Features

- ♿️ **Accessibility** *Fully accessible (WAI-ARIA compliant)*
- 🔄 **Orientation** *Horizontal and vertical orientation support*
- ✨ **UI** *Modern interface with smooth transitions*
- 📝 **Forms** *Ready for form integration*
- 🔍 **Validation** *Built-in step validation support*
- 🎭 **Dynamic** *Flexible content management*
- 🎨 **Customization** *Configurable styling and icons*

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/stepper
```

```sh [bun]
bun install @stacksjs/stepper
```

```sh [pnpm]
pnpm add @stacksjs/stepper
```

```sh [yarn]
yarn add @stacksjs/stepper
```

:::
<br>

## Basic Usage

Here's a basic example of how to use the stepper component:

```vue
<script setup>
import { ref } from 'vue'
import { Stepper } from '@stacksjs/stepper'

const currentStep = ref(0)
const steps = [
  {
    title: 'Step 1',
    description: 'First step'
  },
  {
    title: 'Step 2',
    description: 'Second step'
  },
  {
    title: 'Step 3',
    description: 'Third step'
  }
]
</script>

<template>
  <div class="p-8">
    <Stepper
      v-model="currentStep"
      :steps="steps"
      orientation="horizontal"
    />
  </div>
</template>
```

## Advanced Usage

Here's a more complete example with form integration and navigation:

```vue
<script setup>
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

// Navigation functions
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

// Dynamic content based on current step
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
    <!-- Stepper Component -->
    <Stepper
      ref="stepperRef"
      v-model="currentStep"
      :steps="steps"
      orientation="horizontal"
      class="mb-12"
    />

    <!-- Dynamic Content Section -->
    <div class="mb-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ currentContent.title }}
      </h2>
      <p class="text-gray-600 mb-6">
        {{ currentContent.description }}
      </p>

      <!-- Step Content Here -->
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-center gap-4">
      <button
        class="rounded-md bg-gray-50 px-4 py-2 text-sm font-medium"
        :disabled="currentStep === 0"
        @click="previous"
      >
        Previous
      </button>
      <button
        class="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        :disabled="currentStep === steps.length - 1"
        @click="next"
      >
        Next
      </button>
      <button
        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium"
        @click="reset"
      >
        Reset
      </button>
    </div>
  </div>
</template>
```

## API Reference

### Stepper Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `v-model` | `number` | `0` | Current step index |
| `steps` | `Array` | `[]` | Array of step objects |
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | Stepper orientation |
| `allowSkip` | `boolean` | `false` | Allow skipping steps |
| `showStepDescription` | `boolean` | `true` | Show step descriptions |
| `showStepSubtitle` | `boolean` | `true` | Show step subtitles |

### Step Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Step title |
| `description` | `string` | Step description |
| `icon` | `string` | Custom icon class |
| `validator` | `Function` | Step validation function |

### Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `update:modelValue` | `(step: number)` | Emitted when current step changes |
| `step-complete` | `(step: number)` | Emitted when a step is completed |
| `step-error` | `(step: number, error: Error)` | Emitted when step validation fails |

## Styling

The stepper component comes with a default modern style but can be customized using CSS variables and classes:

```css
:deep(.stepper) {
  --tw-primary-100: rgb(219 234 254);
  --tw-primary-600: rgb(37 99 235);
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
```

## Accessibility

The stepper component follows WAI-ARIA guidelines and includes:

- Proper ARIA attributes for steps and navigation
- Keyboard navigation support
- Focus management
- Screen reader announcements for step changes
- Clear visual indicators for current and completed steps

## TypeScript Support

The stepper includes TypeScript definitions for props and events:

```ts
interface Step {
  title: string
  description?: string
  icon?: string
  validator?: () => Promise<boolean> | boolean
}

interface StepperProps {
  modelValue: number
  steps: Step[]
  orientation?: 'horizontal' | 'vertical'
  allowSkip?: boolean
  showStepDescription?: boolean
  showStepSubtitle?: boolean
}
```

Need help with the stepper component? Feel free to reach out to our support team.
