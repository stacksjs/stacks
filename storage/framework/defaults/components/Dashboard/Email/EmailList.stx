<script setup lang="ts">
import { computed } from 'vue'

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
  emails: Email[]
  activeFolder: string
  searchQuery: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'open', email: Email): void
  (e: 'toggleStar', emailId: number): void
}>()

// Filtered emails based on active folder and search
const filteredEmails = computed(() => {
  let filtered = props.emails.filter(email => {
    // Filter by folder or starred
    if (props.activeFolder === 'starred') {
      return email.starred
    } else {
      return email.folder === props.activeFolder
    }
  })

  // Filter by search
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase()
    filtered = filtered.filter(email =>
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.preview.toLowerCase().includes(query)
    )
  }

  // Sort by date (newest first)
  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

// Format the date to a readable format
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= today) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (date >= yesterday) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}

const openEmail = (email: Email) => {
  emit('open', email)
}

const toggleStar = (emailId: number, event: Event) => {
  event.stopPropagation()
  emit('toggleStar', emailId)
}
</script>

<template>
  <div class="w-full md:w-1/3 lg:w-2/5 border-r border-gray-200 dark:border-blue-gray-600 flex flex-col">
    <div class="bg-white dark:bg-blue-gray-700 py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          {{ props.activeFolder.charAt(0).toUpperCase() + props.activeFolder.slice(1) }}
        </h2>
        <div class="flex space-x-2 ml-4">
          <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
            <i class="i-hugeicons-refresh text-gray-500 dark:text-gray-400 text-lg"></i>
          </button>
          <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
            <i class="i-hugeicons-more-vertical-circle-01 text-gray-500 dark:text-gray-400 text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <ul class="divide-y divide-gray-200 dark:divide-blue-gray-600">
        <li
          v-for="email in filteredEmails"
          :key="email.id"
          @click="openEmail(email)"
          :class="[
            'hover:bg-gray-100 dark:hover:bg-blue-gray-600 cursor-pointer',
            !email.read ? 'bg-blue-50 dark:bg-blue-gray-800' : 'bg-white dark:bg-blue-gray-700'
          ]"
        >
          <div class="px-4 py-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium" :class="[!email.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300']">
                {{ email.from }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(email.date) }}
              </p>
            </div>
            <div class="flex items-center justify-between mt-1">
              <p class="text-sm" :class="[!email.read ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-300']">
                {{ email.subject }}
              </p>
              <div class="flex items-center space-x-1">
                <button @click="(e) => toggleStar(email.id, e)" class="text-gray-400 hover:text-yellow-400">
                  <span v-if="email.starred" class="text-yellow-400 text-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z"/>
                    </svg>
                  </span>
                  <i v-else class="i-hugeicons-star text-lg"></i>
                </button>
                <span v-if="email.attachment" class="text-gray-400">
                  <i class="i-hugeicons-attachment-01 text-lg"></i>
                </span>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {{ email.preview }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
