<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../../Buttons/AppButton.vue'
import BaseModal from '../BaseModal.vue'

const { title, description, type, confirmationText, abortText } = defineProps<Props>()

const emit = defineEmits(['cancel', 'confirm'])

interface Props {
  title: string
  description: string
  type: string
  confirmationText: string
  abortText: string
}

const buttonBackground = computed(() => {
  if (type === 'info')
    return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'

  if (type === 'warning')
    return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'

  if (type === 'danger')
    return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'

  if (type === 'success')
    return 'bg-green-600 hover:bg-green-700 focus:ring-green-500'

  return 'bg-white-600 hover:bg-gray-50  '
})

function abortAction() {
  emit('cancel')
}
function confirmAction() {
  emit('confirm')
}
</script>

<template>
  <BaseModal @close-modal="abortAction()">
    <template #modal-body>
      <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
        <button
          type="button"
          class="rounded-md text-gray-400 dark:text-gray-200 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark-hover:text-gray-100"
          @click="abortAction()"
        >
          <span class="sr-only">Close</span>
          <!-- Heroicon name: outline/x-mark -->
          <svg
            class="h-6 w-6"
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

      <div class="sm:flex sm:items-start">
        <div
          v-if="type === 'warning'"
          class="mx-auto h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10"
        >
          <!-- Heroicon name: outline/exclamation-triangle -->
          <svg
            class="h-6 w-6 text-yellow-600"
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div
          v-if="type === 'success'"
          class="mx-auto h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10"
        >
          <svg
            class="h-6 w-6 text-green-600"
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
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div
          v-if="type === 'error'"
          class="mx-auto h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"
        >
          <svg
            class="h-6 w-6 text-red-600"
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
          class="mx-auto h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10"
        >
          <svg
            class="h-6 w-6 text-blue-600"
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

        <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
          <h3
            id="modal-title"
            class="text-lg text-gray-900 font-medium leading-6 dark:text-gray-100"
          >
            {{ title }}
          </h3>
          <div class="mt-2">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ description }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #modal-actions>
      <AppButton
        :button-text="String(confirmationText)"
        loading-text="Confirming..."
        :passed-class="`primary-button ${buttonBackground}`"
        @click="confirmAction()"
      />

      <button
        v-if="abortText"
        type="button"
        class="secondary-button mr-4"
        @click="abortAction()"
      >
        {{ abortText }}
      </button>
    </template>
  </BaseModal>
</template>
