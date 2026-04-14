```vue
<script lang="ts" setup>
import { ref } from '@stacksjs/stx'
import { Notification, notification } from '@stacksjs/notifications'

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
type Theme = 'light' | 'dark' | 'system'

const position = ref<Position>('top-right')
const theme = ref<Theme>('light')

const showBasicNotification = () => {
  notification('This is a basic notification')
}

const showSuccessNotification = () => {
  notification.success('Operation completed successfully!', {
    description: 'Your changes have been saved.',
    duration: 3000
  })
}

const showErrorNotification = () => {
  notification.error('Error occurred', {
    description: 'Please try again later.',
    closeButton: true
  })
}

const showLoadingNotification = () => {
  const loadingId = notification.loading('Processing your request...', {
    duration: 3000
  })

  // Simulate async operation
  setTimeout(() => {
    notification.success('Process completed!', {
      id: loadingId
    })
  }, 3000)
}

const showPromiseNotification = () => {
  const promise = new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        resolve('Data successfully fetched!')
      } else {
        reject('Failed to fetch data')
      }
    }, 2000)
  })

  notification.promise(promise, {
    loading: 'Fetching data...',
    success: (data) => data,
    error: (error) => error
  })
}

const showCustomNotification = () => {
  notification.custom('Custom Notification', {
    description: 'This is a custom styled notification',
    duration: 4000,
    style: {
      background: 'linear-gradient(to right, #00b09b, #96c93d)',
      color: 'white'
    }
  })
}
</script>

<template>
  <div class="p-6 space-y-6">
    <h2 class="mb-4 font-bold text-2xl">Notification Demo</h2>

    <div class="space-y-4">
      <div class="flex flex-wrap gap-4">
        <button
          @click="showBasicNotification"
          class="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded"
        >
          Basic Notification
        </button>

        <button
          @click="showSuccessNotification"
          class="px-4 py-2 text-white bg-green-500 hover:bg-green-600 rounded"
        >
          Success Notification
        </button>

        <button
          @click="showErrorNotification"
          class="px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded"
        >
          Error Notification
        </button>

        <button
          @click="showLoadingNotification"
          class="px-4 py-2 text-white bg-yellow-500 hover:bg-yellow-600 rounded"
        >
          Loading Notification
        </button>

        <button
          @click="showPromiseNotification"
          class="px-4 py-2 text-white bg-purple-500 hover:bg-purple-600 rounded"
        >
          Promise Notification
        </button>

        <button
          @click="showCustomNotification"
          class="px-4 py-2 text-white bg-gray-500 hover:bg-gray-600 rounded"
        >
          Custom Notification
        </button>
      </div>

      <div class="space-y-2">
        <label class="block">
          Position:
          <select
            v-model="position"
            class="ml-2 p-1 border rounded"
          >
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-center">Top Center</option>
            <option value="bottom-center">Bottom Center</option>
          </select>
        </label>

        <label class="block">
          Theme:
          <select
            v-model="theme"
            class="ml-2 p-1 border rounded"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
      </div>
    </div>

    <Notification
    :position="position"
    :theme="theme"
    :close-button="true"
  />
  </div>
</template>

<style scoped>
.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.space-y-4 > * + * {
  margin-top: 1rem;
}

.space-y-2 > * + * {
  margin-top: 0.5rem;
}
</style>
```
