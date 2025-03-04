<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useRouter } from 'vue-router'
import EmailSidebar from '../../../components/Dashboard/Email/EmailSidebar.vue'

useHead({
  title: 'Mail - Settings',
})

const router = useRouter()
const activeFolder = ref('inbox')
const isLoading = ref(false)

// Folder structure
const folders = [
  { id: 'inbox', name: 'Inbox', icon: 'inbox' },
  { id: 'starred', name: 'Starred', icon: 'star' },
  { id: 'sent', name: 'Sent', icon: 'mail-send-01' },
  { id: 'drafts', name: 'Drafts', icon: 'license-draft' },
  { id: 'archive', name: 'Archive', icon: 'archive' },
  { id: 'spam', name: 'Spam', icon: 'spam' },
  { id: 'trash', name: 'Trash', icon: 'waste' },
]

// Mock unread counts
const unreadCounts = computed(() => {
  return {
    inbox: 2,
    starred: 1,
    sent: 0,
    drafts: 0,
    archive: 0,
    spam: 1,
    trash: 0,
  }
})

// Settings sections
const settingsSections = ref([
  {
    id: 'general',
    name: 'General',
    icon: 'i-hugeicons-settings-01',
    active: true,
  },
  {
    id: 'accounts',
    name: 'Account',
    icon: 'i-hugeicons-mail-account-02',
    active: false,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: 'i-hugeicons-notification-01',
    active: false,
  },
  {
    id: 'filters',
    name: 'Filters & Blocking',
    icon: 'i-hugeicons-filter-mail-circle',
    active: false,
  },
  {
    id: 'labels',
    name: 'Labels',
    icon: 'i-hugeicons-tag-01',
    active: false,
  },
  {
    id: 'security',
    name: 'Security',
    icon: 'i-hugeicons-security-check',
    active: false,
  },
])

// Settings form data
const settings = ref({
  general: {
    displayDensity: 'default',
    defaultReplyBehavior: 'replyAll',
    sendAndArchive: true,
    autoAdvance: 'newer',
    desktopNotifications: true,
    theme: 'system',
    language: 'en',
  },
  accounts: {
    primaryEmail: 'me@stacksjs.org',
    name: 'User',
    signature: '<p>Best regards,<br>User</p>',
    vacationResponder: {
      enabled: false,
      startDate: '',
      endDate: '',
      subject: 'Out of Office',
      message: 'I am currently out of office with limited access to email.',
    },
  },
})

// Active section
const activeSection = ref('general')

const setActiveSection = (sectionId: string) => {
  activeSection.value = sectionId
  settingsSections.value.forEach(section => {
    section.active = section.id === sectionId
  })
}

// Function to handle folder change
const handleFolderChange = (folder: string) => {
  // Update the active folder
  activeFolder.value = folder
  // Navigate to the inbox page with the selected folder
  router.push({
    path: '/inbox',
    query: { folder }
  })
}

// Function to handle compose
const handleCompose = () => {
  router.push('/inbox?compose=true')
}

// Save settings
const saveSettings = () => {
  isLoading.value = true
  // Simulate API call
  setTimeout(() => {
    isLoading.value = false
    // Show success message
    alert('Settings saved successfully')
  }, 1000)
}

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen dark:bg-blue-gray-800">
    <div class="flex h-screen">
      <!-- Sidebar -->
      <EmailSidebar
        :active-folder="activeFolder"
        :folders="folders"
        :unread-counts="unreadCounts"
        @update:active-folder="(folder) => { activeFolder = folder; handleFolderChange(folder); }"
        @compose="handleCompose"
      />

      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 py-4 px-6">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <div>
              <button
                @click="saveSettings"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium text-sm flex items-center"
                :disabled="isLoading"
              >
                <i class="i-hugeicons-checkmark-circle-02 text-lg mr-2" v-if="!isLoading"></i>
                <i class="i-hugeicons-refresh animate-spin text-lg mr-2" v-else></i>
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Settings Content -->
        <div class="flex-1 overflow-hidden flex">
          <!-- Settings Navigation -->
          <div class="w-64 border-r border-gray-200 dark:border-blue-gray-600 bg-white dark:bg-blue-gray-700 overflow-y-auto">
            <nav class="p-4">
              <ul class="space-y-1">
                <li v-for="section in settingsSections" :key="section.id">
                  <button
                    @click="setActiveSection(section.id)"
                    :class="[
                      'w-full flex items-center px-3 py-3 text-sm rounded-md',
                      section.active
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                    ]"
                  >
                    <i :class="[section.icon, 'text-lg']"></i>
                    <span class="ml-3">{{ section.name }}</span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          <!-- Settings Form -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- General Settings -->
            <div v-if="activeSection === 'general'" class="space-y-6">
              <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
                <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Settings</h2>

                <div class="space-y-4">
                  <div>
                    <label for="displayDensity" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Density</label>
                    <select
                      id="displayDensity"
                      v-model="settings.general.displayDensity"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="default">Default</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>

                  <div>
                    <label for="theme" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
                    <select
                      id="theme"
                      v-model="settings.general.theme"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System Default</option>
                    </select>
                  </div>

                  <div>
                    <label for="language" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                    <select
                      id="language"
                      v-model="settings.general.language"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="es">Spanish</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
                <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Behavior</h2>

                <div class="space-y-4">
                  <div>
                    <label for="defaultReplyBehavior" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Reply Behavior</label>
                    <select
                      id="defaultReplyBehavior"
                      v-model="settings.general.defaultReplyBehavior"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="reply">Reply</option>
                      <option value="replyAll">Reply All</option>
                    </select>
                  </div>

                  <div>
                    <label for="autoAdvance" class="block text-sm font-medium text-gray-700 dark:text-gray-300">After archiving or deleting an email, show</label>
                    <select
                      id="autoAdvance"
                      v-model="settings.general.autoAdvance"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="newer">Newer conversation</option>
                      <option value="older">Older conversation</option>
                      <option value="back">Back to inbox</option>
                    </select>
                  </div>

                  <div class="flex items-center">
                    <input
                      id="sendAndArchive"
                      type="checkbox"
                      v-model="settings.general.sendAndArchive"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    >
                    <label for="sendAndArchive" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Show "Send & Archive" button in reply
                    </label>
                  </div>

                  <div class="flex items-center">
                    <input
                      id="desktopNotifications"
                      type="checkbox"
                      v-model="settings.general.desktopNotifications"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    >
                    <label for="desktopNotifications" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Enable desktop notifications
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Account Settings -->
            <div v-if="activeSection === 'accounts'" class="space-y-6">
              <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
                <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Information</h2>

                <div class="space-y-4">
                  <div>
                    <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Name</label>
                    <input
                      id="name"
                      type="text"
                      v-model="settings.accounts.name"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                  </div>

                  <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      v-model="settings.accounts.primaryEmail"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                  </div>
                </div>
              </div>

              <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
                <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Signature</h2>

                <div>
                  <label for="signature" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Signature</label>
                  <div class="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 p-2">
                    <textarea
                      id="signature"
                      v-model="settings.accounts.signature"
                      rows="4"
                      class="block w-full px-3 py-2 border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 sm:text-sm"
                    ></textarea>
                  </div>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">HTML formatting is supported</p>
                </div>
              </div>

              <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-medium text-gray-900 dark:text-white">Vacation Responder</h2>
                  <div class="flex items-center">
                    <span class="text-sm text-gray-700 dark:text-gray-300 mr-2">Off</span>
                    <button
                      type="button"
                      @click="settings.accounts.vacationResponder.enabled = !settings.accounts.vacationResponder.enabled"
                      :class="[
                        'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                        settings.accounts.vacationResponder.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      ]"
                    >
                      <span
                        :class="[
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200',
                          settings.accounts.vacationResponder.enabled ? 'translate-x-5' : 'translate-x-0'
                        ]"
                      ></span>
                    </button>
                    <span class="text-sm text-gray-700 dark:text-gray-300 ml-2">On</span>
                  </div>
                </div>

                <div v-if="settings.accounts.vacationResponder.enabled" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label for="startDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                      <input
                        id="startDate"
                        type="date"
                        v-model="settings.accounts.vacationResponder.startDate"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                    </div>
                    <div>
                      <label for="endDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                      <input
                        id="endDate"
                        type="date"
                        v-model="settings.accounts.vacationResponder.endDate"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                    </div>
                  </div>

                  <div>
                    <label for="subject" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                    <input
                      id="subject"
                      type="text"
                      v-model="settings.accounts.vacationResponder.subject"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                  </div>

                  <div>
                    <label for="message" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                    <textarea
                      id="message"
                      v-model="settings.accounts.vacationResponder.message"
                      rows="4"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <!-- Other sections (placeholder) -->
            <div v-if="activeSection !== 'general' && activeSection !== 'accounts'" class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
              <div class="flex flex-col items-center justify-center py-12">
                <div class="rounded-full bg-blue-100 dark:bg-blue-900 p-6 mb-4">
                  <i :class="settingsSections.find(s => s.id === activeSection)?.icon + ' text-blue-600 dark:text-blue-400 text-4xl'"></i>
                </div>
                <h2 class="text-xl font-medium text-gray-900 dark:text-white mb-2">
                  {{ settingsSections.find(s => s.id === activeSection)?.name }} Settings
                </h2>
                <p class="text-gray-500 dark:text-gray-400 text-center max-w-md">
                  This section is under development. More settings will be available soon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
