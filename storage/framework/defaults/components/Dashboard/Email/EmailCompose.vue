<script setup lang="ts">
import { ref } from 'vue'

interface NewEmail {
  to: string
  subject: string
  body: string
}

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'send', email: NewEmail): void
}>()

const newEmail = ref<NewEmail>({
  to: '',
  subject: '',
  body: '',
})

const cancelCompose = () => {
  emit('cancel')
}

const sendEmail = () => {
  emit('send', newEmail.value)
}
</script>

<template>
  <div class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
    <div class="py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
      <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
        New Message
      </h2>
      <button @click="cancelCompose" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
        <i class="i-hugeicons-cancel-circle text-gray-500 dark:text-gray-400 text-lg"></i>
      </button>
    </div>

    <div class="flex-1 p-4 overflow-y-auto">
      <div class="space-y-4">
        <div>
          <label for="to" class="block text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
          <input
            id="to"
            v-model="newEmail.to"
            type="text"
            class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label for="subject" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
          <input
            id="subject"
            v-model="newEmail.subject"
            type="text"
            class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label for="body" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
          <textarea
            id="body"
            v-model="newEmail.body"
            rows="15"
            class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          ></textarea>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-200 dark:border-blue-gray-600 flex justify-between">
      <div class="flex space-x-2">
        <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-attachment-01 text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
        <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-image-01 text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
        <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-smile text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
      </div>
      <div>
        <button @click="sendEmail" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium text-sm">
          Send
        </button>
      </div>
    </div>
  </div>
</template>
