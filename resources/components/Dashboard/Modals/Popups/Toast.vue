<script setup lang="ts">
import { ref, watch } from 'vue'
import ToastWrapper from '../ToastWrapper.vue'

const show = ref(false)

const type = ref('warning')

watch(
  () => show,
  (current) => {
    if (current) {
      setTimeout(() => {
        show.value = !show.value
      }, 5000)
    }
  },
)
</script>

<template>
  <ToastWrapper
    v-if="show"
    :width="30"
    position="top-right"
    @close-toast="closeAction()"
  >
    <template #modal-body>
      <div
        v-if="type === 'warning'"
        class="flex-shrink-0"
      >
        <svg
          class="h-6 w-6 text-yellow-400"
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
        v-if="type === 'success'"
        class="flex-shrink-0"
      >
        <svg
          class="h-6 w-6 text-green-400"
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
        v-if="type === 'error'"
        class="flex-shrink-0"
      >
        <svg
          class="h-6 w-6 text-red-400"
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
        v-if="type === 'info'"
        class="flex-shrink-0"
      >
        <svg
          class="h-6 w-6 text-blue-400"
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
        <p class="text-left text-sm text-gray-900 font-medium dark:text-gray-100">
          sample title
        </p>
      </div>
    </template>
  </ToastWrapper>
</template>
