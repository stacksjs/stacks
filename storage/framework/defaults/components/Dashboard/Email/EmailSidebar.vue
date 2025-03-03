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
</script>

<template>
  <div
    :class="[
      'bg-gray-100 dark:bg-blue-gray-700 flex flex-col transition-all duration-300 ease-in-out',
      sidebarOpen ? 'w-64' : 'w-16'
    ]"
  >
    <div class="p-4 flex items-center justify-between border-b border-gray-200 dark:border-blue-gray-600">
      <h1
        :class="[
          'font-bold text-xl text-gray-900 dark:text-white',
          !sidebarOpen && 'sr-only'
        ]"
      >
        Mail
      </h1>
      <button
        @click="sidebarOpen = !sidebarOpen"
        class="p-1 rounded-md text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-white"
      >
        <i class="i-hugeicons-menu-01 text-xl"></i>
      </button>
    </div>

    <div class="p-4">
      <button
        @click="startCompose"
        class="w-full flex items-center justify-center rounded-md bg-blue-600 px-3 py-3 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500"
      >
        <i class="i-hugeicons-plus-sign text-lg mr-2" :class="{ 'mr-0': !sidebarOpen }"></i>
        <span v-if="sidebarOpen">Compose</span>
      </button>
    </div>

    <nav class="mt-2 flex-1 overflow-y-auto">
      <ul class="space-y-1 px-2">
        <li v-for="folder in folders" :key="folder.id">
          <button
            @click="setActiveFolder(folder.id)"
            :class="[
              'w-full flex items-center justify-start px-3 py-3 text-sm rounded-md',
              activeFolder === folder.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-blue-gray-600'
            ]"
          >
            <span class="flex-shrink-0">
              <!-- Icons based on folder type -->
              <i v-if="folder.icon === 'inbox'" class="i-hugeicons-inbox text-xl"></i>
              <i v-else-if="folder.icon === 'star'" class="i-hugeicons-star text-xl"></i>
              <i v-else-if="folder.icon === 'mail-send-01'" class="i-hugeicons-mail-send-02 text-xl"></i>
              <i v-else-if="folder.icon === 'license-draft'" class="i-hugeicons-license-draft text-xl"></i>
              <i v-else-if="folder.icon === 'archive'" class="i-hugeicons-archive text-xl"></i>
              <i v-else-if="folder.icon === 'spam'" class="i-hugeicons-spam text-xl"></i>
              <i v-else-if="folder.icon === 'waste'" class="i-hugeicons-waste text-xl"></i>
              <i v-else class="i-hugeicons-file-01 text-xl"></i>
            </span>
            <span v-if="sidebarOpen" class="flex-1 ml-3 text-left">{{ folder.name }}</span>
            <span v-if="sidebarOpen && getUnreadCount(folder.id) > 0"
              class="inline-flex items-center justify-center ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              {{ getUnreadCount(folder.id) }}
            </span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- Account Section -->
    <div class="p-4 border-t border-gray-200 dark:border-blue-gray-600">
      <div class="flex items-center">
        <div class="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
          M
        </div>
        <div v-if="sidebarOpen" class="ml-3">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-200">me@stacksjs.org</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">5.2 GB of 15 GB used</p>
        </div>
      </div>
    </div>
  </div>
</template>
