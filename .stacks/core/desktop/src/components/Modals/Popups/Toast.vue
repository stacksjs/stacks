<script setup lang="ts">
import { watch } from 'vue'

import { useToastStore } from '~/stores/toast'

const toastStore = useToastStore()

function closeAction() {
  toastStore.toggleToast(false)
}

watch(
  () => toastStore.show,
  (current) => {
    if (current) {
      setTimeout(() => {
        toastStore.toggleToast(false)
      }, toastStore.duration)
    }
  },
)
</script>

<template>
  <ToastWrapper
    v-if="toastStore.show"
    :width="30"
    :position="toastStore.position"
  >
    <template #modal-body>
      <div class="absolute top-0 right-0 hidden pt-3.5 pr-2 sm:block">
        <button
          type="button"
          class="rounded-md text-gray-50 dark:text-gray-200 dark-hover:text-gray-100 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
          @click="closeAction()"
        >
          <span class="sr-only">Close</span>
          <!-- Heroicon name: outline/x-mark -->
          <svg
            class="w-6 h-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div
        v-if="toastStore.type === 'warning'"
        class="flex-shrink-0"
      >
        <svg
          class="w-6 h-6 text-yellow-400"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <div
        v-if="toastStore.type === 'success'"
        class="flex-shrink-0"
      >
        <svg
          class="w-6 h-6 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div
        v-if="toastStore.type === 'error'"
        class="flex-shrink-0"
      >
        <svg
          class="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div
        v-if="toastStore.type === 'info'"
        class="flex-shrink-0"
      >
        <svg
          class="w-6 h-6 text-blue-400"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </div>

      <div class="ml-3 w-0 flex-1 pt-0.5">
        <p class="text-sm font-medium text-left text-gray-900 dark:text-gray-100">
          {{ toastStore.title }}
        </p>
      </div>
    </template>
  </ToastWrapper>
</template>
