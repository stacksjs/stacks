<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  activeFolder: string
  folders: Array<{
    id: string
    name: string
    icon: string
  }>
  unreadCounts: Record<string, number>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:activeFolder', value: string): void
  (e: 'compose'): void
}>()

const sidebarOpen = ref(true)

const setActiveFolder = (folderId: string) => {
  emit('update:activeFolder', folderId)
}

const startCompose = () => {
  emit('compose')
}

const getUnreadCount = (folderId: string): number => {
  return props.unreadCounts[folderId] || 0
}

// User info
const userInfo = {
  name: 'Alicia Koch',
  email: 'alicia@example.com',
  initial: 'A'
}
</script>

<template>
  <div
    class="w-64 flex flex-col border-r border-gray-200 dark:border-blue-gray-600 bg-white dark:bg-blue-gray-800"
  >
    <!-- User dropdown -->
    <div class="p-3 border-b border-gray-200 dark:border-blue-gray-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="flex items-center justify-center w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded">
            <i class="i-hugeicons-alert-02 text-sm"></i>
          </div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ userInfo.name }}</span>
        </div>
        <button class="text-gray-500 dark:text-gray-400">
          <i class="i-hugeicons-arrow-down-02 text-sm"></i>
        </button>
      </div>
    </div>

    <!-- Folders -->
    <div class="flex-1 overflow-y-auto">
      <nav class="mt-1">
        <ul>
          <li v-for="folder in folders" :key="folder.id" class="mb-1">
            <button
              @click="setActiveFolder(folder.id)"
              class="w-full flex items-center justify-between px-4 py-2 text-sm"
              :class="[
                activeFolder === folder.id
                  ? 'bg-gray-100 dark:bg-blue-gray-700 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="flex items-center">
                <i v-if="folder.id === 'inbox'" class="i-hugeicons-inbox text-lg mr-3"></i>
                <i v-else-if="folder.id === 'drafts'" class="i-hugeicons-edit-01 text-lg mr-3"></i>
                <i v-else-if="folder.id === 'sent'" class="i-hugeicons-sent text-lg mr-3"></i>
                <i v-else-if="folder.id === 'trash'" class="i-hugeicons-waste text-lg mr-3"></i>
                <i v-else-if="folder.id === 'archive'" class="i-hugeicons-archive text-lg mr-3"></i>
                <i v-else-if="folder.id === 'spam'" class="i-hugeicons-spam text-lg mr-3"></i>
                <i v-else-if="folder.id === 'starred'" class="i-hugeicons-star text-lg mr-3"></i>
                <span>{{ folder.name }}</span>
              </div>
              <span v-if="getUnreadCount(folder.id) > 0"
                class="bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                {{ getUnreadCount(folder.id) }}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Categories -->
      <div class="mt-6 px-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Categories
        </h3>
        <nav class="mt-2">
          <ul>
            <li class="mb-1">
              <button class="w-full flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 rounded">
                <i class="i-hugeicons-user text-lg mr-3"></i>
                <span>Social</span>
                <span class="ml-auto bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                  972
                </span>
              </button>
            </li>
            <li class="mb-1">
              <button class="w-full flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 rounded">
                <i class="i-hugeicons-notification-03 text-lg mr-3"></i>
                <span>Updates</span>
                <span class="ml-auto bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                  342
                </span>
              </button>
            </li>
            <li class="mb-1">
              <button class="w-full flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 rounded">
                <i class="i-hugeicons-chatting-01 text-lg mr-3"></i>
                <span>Forums</span>
                <span class="ml-auto bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                  128
                </span>
              </button>
            </li>
            <li class="mb-1">
              <button class="w-full flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 rounded">
                <i class="i-hugeicons-shopping-cart-02 text-lg mr-3"></i>
                <span>Shopping</span>
                <span class="ml-auto bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                  8
                </span>
              </button>
            </li>
            <li class="mb-1">
              <button class="w-full flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 rounded">
                <i class="i-hugeicons-tag-01 text-lg mr-3"></i>
                <span>Promotions</span>
                <span class="ml-auto bg-gray-200 dark:bg-blue-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 rounded-full">
                  21
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>
