<script setup lang="ts">
interface Email {
  id: number
  from: string
  email: string
  subject: string
  preview: string
  body: string
  date: string
  read: boolean
  starred: boolean
  folder: string
  attachment: boolean
}

interface Props {
  email: Email
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggleStar', emailId: number): void
}>()

const closeEmail = () => {
  emit('close')
}

const toggleStar = () => {
  emit('toggleStar', props.email.id)
}
</script>

<template>
  <div class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
    <div class="py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button @click="closeEmail" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-arrow-left-02 text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          {{ email.subject }}
        </h2>
      </div>
      <div class="flex space-x-2">
        <button @click="toggleStar" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <span v-if="email.starred" class="text-yellow-400 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z"/>
            </svg>
          </span>
          <i v-else class="i-hugeicons-star text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
        <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-inbox text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
        <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
          <i class="i-hugeicons-waste text-gray-500 dark:text-gray-400 text-lg"></i>
        </button>
      </div>
    </div>

    <div class="px-4 py-3 border-b border-gray-200 dark:border-blue-gray-600">
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center">
            <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
              {{ email.from.charAt(0) }}
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ email.from }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ email.email }}</p>
            </div>
          </div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ new Date(email.date).toLocaleString() }}
        </div>
      </div>
      <div class="mt-2">
        <p class="text-base font-medium text-gray-900 dark:text-gray-100">{{ email.subject }}</p>
      </div>
    </div>

    <div class="flex-1 p-4 overflow-y-auto">
      <div v-html="email.body" class="prose dark:prose-invert max-w-none"></div>

      <div v-if="email.attachment" class="mt-4 border border-gray-200 dark:border-blue-gray-600 rounded p-3">
        <div class="flex items-center">
          <i class="i-hugeicons-file-01 text-gray-500 dark:text-gray-400 text-xl"></i>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Document.pdf</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">1.2 MB</p>
          </div>
          <button class="ml-auto p-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800">
            <i class="i-hugeicons-download-04 text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-200 dark:border-blue-gray-600">
      <div class="flex space-x-2">
        <button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium text-sm">
          Reply
        </button>
        <button class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-blue-gray-600 font-medium text-sm">
          Forward
        </button>
      </div>
    </div>
  </div>
</template>
