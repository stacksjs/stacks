<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute } from 'vue-router'
import EmailSidebar from '../../../components/Dashboard/Email/EmailSidebar.vue'

useHead({
  title: 'Mail - Your Inbox',
})

// Define the Email interface
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

const sidebarOpen = ref(true)
const activeFolder = ref('inbox')
const selectedEmail = ref<Email | null>(null)
const searchQuery = ref('')
const isComposing = ref(false)
const isLoading = ref(false)

// Email data
const emails = ref<Email[]>([
  {
    id: 1,
    from: 'Chris Breuer',
    email: 'chris@stacksjs.org',
    subject: 'New Project Roadmap',
    preview: 'Hey team, I wanted to share the roadmap for our next project. We\'ll be focusing on...',
    body: `
      <p>Hey team,</p>
      <p>I wanted to share the roadmap for our next project. We'll be focusing on building a robust email API that integrates seamlessly with our existing stack.</p>
      <p>Key milestones:</p>
      <ul>
        <li>API design by May 1st</li>
        <li>Initial implementation by June 15th</li>
        <li>Testing phase until July 10th</li>
        <li>Production release by August 1st</li>
      </ul>
      <p>Please review and let me know your thoughts.</p>
      <p>Best,<br>Chris</p>
    `,
    date: '2024-02-28T10:23:00',
    read: false,
    starred: true,
    folder: 'inbox',
    attachment: true,
  },
  {
    id: 2,
    from: 'Blake',
    email: 'blake@stacksjs.org',
    subject: 'Design Review Scheduled',
    preview: 'Hi all, I\'ve scheduled the design review for Thursday at 2pm. Please review the mockups before...',
    body: `
      <p>Hi all,</p>
      <p>I've scheduled the design review for Thursday at 2pm. Please review the mockups before our meeting so we can have a productive discussion.</p>
      <p>You can find the latest designs here: <a href="#">https://figma.com/design/mail-app</a></p>
      <p>Looking forward to your feedback.</p>
      <p>-Blake</p>
    `,
    date: '2024-02-27T16:42:00',
    read: true,
    starred: false,
    folder: 'inbox',
    attachment: false,
  },
  {
    id: 3,
    from: 'Sarah Johnson',
    email: 'sarah@stacksjs.org',
    subject: 'Weekly Team Update',
    preview: 'Team, here\'s our weekly progress update. Frontend team completed the new navigation...',
    body: `
      <p>Team,</p>
      <p>Here's our weekly progress update:</p>
      <ul>
        <li>Frontend team completed the new navigation components</li>
        <li>Backend team implemented the new authentication system</li>
        <li>DevOps set up the new CI/CD pipeline</li>
      </ul>
      <p>Overall, we're on track for our monthly goals.</p>
      <p>Great work everyone!</p>
      <p>Sarah</p>
    `,
    date: '2024-02-26T09:15:00',
    read: true,
    starred: true,
    folder: 'inbox',
    attachment: false,
  },
  {
    id: 4,
    from: 'Michael Chen',
    email: 'michael@stacksjs.org',
    subject: 'Bug Fix: Email Rendering Issue',
    preview: 'I fixed the email rendering issue reported last week. The problem was related to...',
    body: `
      <p>Hi team,</p>
      <p>I fixed the email rendering issue reported last week. The problem was related to how we were handling HTML content in the email body.</p>
      <p>The fix has been deployed to production. Please test it out and let me know if you encounter any issues.</p>
      <p>Regards,<br>Michael</p>
    `,
    date: '2024-02-25T14:53:00',
    read: false,
    starred: false,
    folder: 'inbox',
    attachment: false,
  },
  {
    id: 5,
    from: 'Emma Wilson',
    email: 'emma@stacksjs.org',
    subject: 'Client Meeting Notes',
    preview: 'Attached are my notes from yesterday\'s client meeting. We discussed their requirements for...',
    body: `
      <p>Hello,</p>
      <p>Attached are my notes from yesterday's client meeting. We discussed their requirements for the email integration feature and agreed on the following points:</p>
      <ol>
        <li>Support for multiple email accounts</li>
        <li>Unified inbox with smart filtering</li>
        <li>Rich text formatting in compose view</li>
        <li>Attachment handling with preview capability</li>
      </ol>
      <p>They'd like to see a prototype by next month.</p>
      <p>Let me know if you have any questions!</p>
      <p>Best,<br>Emma</p>
    `,
    date: '2024-02-24T11:30:00',
    read: true,
    starred: false,
    folder: 'archive',
    attachment: true,
  },
  {
    id: 6,
    from: 'Calendar',
    email: 'calendar@stacksjs.org',
    subject: 'Reminder: Sprint Planning',
    preview: 'This is a reminder for your Sprint Planning meeting tomorrow at 10:00 AM...',
    body: `
      <p>Reminder:</p>
      <p><strong>Sprint Planning Meeting</strong></p>
      <p>Date: Tomorrow</p>
      <p>Time: 10:00 AM - 11:30 AM</p>
      <p>Location: Conference Room A / Zoom Link: <a href="#">https://zoom.us/j/123456789</a></p>
      <p>Please come prepared with your task estimates and priorities.</p>
    `,
    date: '2024-02-23T09:00:00',
    read: true,
    starred: false,
    folder: 'inbox',
    attachment: false,
  },
  {
    id: 7,
    from: 'Kevin Adams',
    email: 'kevin@stacksjs.org',
    subject: 'Draft: Marketing Email',
    preview: 'Here\'s the draft for our next marketing email. Let me know what you think...',
    body: `
      <p>Hi team,</p>
      <p>Here's the draft for our next marketing email. I've focused on highlighting our new email integration features.</p>
      <p>Key points covered:</p>
      <ul>
        <li>Simplified setup process</li>
        <li>Enhanced security features</li>
        <li>New template system</li>
        <li>Performance improvements</li>
      </ul>
      <p>Please review and suggest any changes by Friday.</p>
      <p>Thanks!<br>Kevin</p>
    `,
    date: '2024-02-22T15:20:00',
    read: false,
    starred: false,
    folder: 'drafts',
    attachment: false,
  },
  {
    id: 8,
    from: 'Support',
    email: 'support@stacksjs.org',
    subject: 'New Support Ticket #1234',
    preview: 'A new support ticket has been assigned to your team. Customer is reporting issues with...',
    body: `
      <p>Ticket #1234</p>
      <p>Priority: Medium</p>
      <p>Customer: Acme Corp</p>
      <p>Issue: Customer is reporting issues with email delivery. Certain emails are being delayed by up to 1 hour.</p>
      <p>Steps to reproduce:</p>
      <ol>
        <li>Send email from external address to user@acmecorp.com</li>
        <li>Email appears in their system after significant delay</li>
      </ol>
      <p>Please investigate and update the ticket when possible.</p>
    `,
    date: '2024-02-21T08:45:00',
    read: true,
    starred: true,
    folder: 'inbox',
    attachment: false,
  },
  {
    id: 9,
    from: 'Newsletter',
    email: 'newsletter@tech-updates.com',
    subject: 'This Week in Web Development',
    preview: 'Top stories: New Vue.js 4 Features, The Future of CSS, TypeScript Best Practices...',
    body: `
      <h2>This Week in Web Development</h2>
      <p>Top stories:</p>
      <ul>
        <li><a href="#">New Vue.js 4 Features You Should Know About</a></li>
        <li><a href="#">The Future of CSS: What's Coming in 2024</a></li>
        <li><a href="#">TypeScript Best Practices for Large Applications</a></li>
        <li><a href="#">How to Optimize Your Web App for Performance</a></li>
      </ul>
      <p>Read these stories and more on our website.</p>
      <p>To unsubscribe, click <a href="#">here</a>.</p>
    `,
    date: '2024-02-20T07:30:00',
    read: false,
    starred: false,
    folder: 'spam',
    attachment: false,
  },
  {
    id: 10,
    from: 'Alex Morgan',
    email: 'alex@stacksjs.org',
    subject: 'Sent: Project Status Update',
    preview: 'Just sent the project status update to the client. They should be pleased with our progress...',
    body: `
      <p>Team,</p>
      <p>I've just sent the project status update to the client. They should be pleased with our progress so far, especially with the email component we delivered ahead of schedule.</p>
      <p>Great job everyone!</p>
      <p>Looking forward to our next milestone.</p>
      <p>Regards,<br>Alex</p>
    `,
    date: '2024-02-19T16:00:00',
    read: true,
    starred: false,
    folder: 'sent',
    attachment: false,
  },
])

// Folder structure
const folders = [
  { id: 'starred', name: 'Starred', icon: 'star' },
  { id: 'sent', name: 'Sent', icon: 'send' },
  { id: 'drafts', name: 'Drafts', icon: 'drafts' },
  { id: 'archive', name: 'Archive', icon: 'archive' },
  { id: 'spam', name: 'Spam', icon: 'spam' },
  { id: 'trash', name: 'Trash', icon: 'waste' },
]

// Filtered emails based on active folder and search
const filteredEmails = computed(() => {
  let filtered = emails.value.filter(email => {
    // Filter by folder or starred
    if (activeFolder.value === 'starred') {
      return email.starred
    } else {
      return email.folder === activeFolder.value
    }
  })

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
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

// Toggle read status
const toggleRead = (emailId: number) => {
  const index = emails.value.findIndex(e => e.id === emailId)
  if (index !== -1) {
    const email = emails.value[index]
    if (email) {
      email.read = !email.read
    }
  }
}

// Toggle star status
const toggleStar = (emailId: number) => {
  const index = emails.value.findIndex(e => e.id === emailId)
  if (index !== -1) {
    const email = emails.value[index]
    if (email) {
      email.starred = !email.starred
    }
  }
}

// Get unread count for a folder
const getUnreadCount = (folder: string) => {
  if (folder === 'starred') {
    return emails.value.filter(e => e.starred && !e.read).length
  }
  return emails.value.filter(e => e.folder === folder && !e.read).length
}

// Unread counts for the sidebar
const unreadCounts = computed(() => {
  const counts: Record<string, number> = {}
  folders.forEach(folder => {
    counts[folder.id] = getUnreadCount(folder.id)
  })
  return counts
})

// Open email detail
const openEmail = (email: Email) => {
  selectedEmail.value = email
  if (!email.read) {
    toggleRead(email.id)
  }
}

// Close email detail
const closeEmail = () => {
  selectedEmail.value = null
}

// Compose new email
interface NewEmail {
  to: string
  subject: string
  body: string
}

const newEmail = ref<NewEmail>({
  to: '',
  subject: '',
  body: '',
})

const startCompose = () => {
  isComposing.value = true
  newEmail.value = {
    to: '',
    subject: '',
    body: '',
  }
}

const cancelCompose = () => {
  isComposing.value = false
}

const sendEmail = () => {
  // Simulate sending email
  const sentEmail = {
    id: emails.value.length + 1,
    from: 'Me',
    email: 'me@stacksjs.org',
    subject: newEmail.value.subject,
    preview: newEmail.value.body.substring(0, 100),
    body: newEmail.value.body,
    date: new Date().toISOString(),
    read: true,
    starred: false,
    folder: 'sent',
    attachment: false,
  }

  emails.value.push(sentEmail)
  isComposing.value = false

  // Show a success toast message or notification here
}

// Initial load
onMounted(async () => {
  isLoading.value = true

  // Check for folder in query params
  const route = useRoute()
  if (route.query.folder && typeof route.query.folder === 'string') {
    activeFolder.value = route.query.folder
  }

  // Check for compose in query params
  if (route.query.compose === 'true') {
    isComposing.value = true
  }

  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})

// Function to get icon for folder
const getFolderIcon = (folderId: string) => {
  const folder = folders.find(f => f.id === folderId)
  return folder ? folder.icon : 'document'
}

// Function to handle folder change
const handleFolderChange = (folder: string) => {
  activeFolder.value = folder
}

// Function to handle compose
const handleCompose = () => {
  isComposing.value = true
}

// Add refresh functionality
const isRefreshing = ref(false)
const refreshEmails = async () => {
  isRefreshing.value = true
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  isRefreshing.value = false
}

// Add dropdown menu state
const showMoreMenu = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const toggleMoreMenu = (event: MouseEvent) => {
  event.stopPropagation()
  showMoreMenu.value = !showMoreMenu.value

  if (showMoreMenu.value) {
    // Add event listener when dropdown is opened
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showMoreMenu.value = false
    document.removeEventListener('click', handleClickOutside)
  }
}

// Clean up event listener when component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Add this computed property
const inboxUnreadCount = computed(() => {
  return unreadCounts.inbox || 0
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
        @update:active-folder="handleFolderChange"
        @compose="handleCompose"
      />

      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Header with search and inbox nav -->
        <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 py-2 px-4">
          <div class="flex items-center justify-between">
            <!-- Search bar -->
            <div class="flex-1 max-w-2xl">
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i class="i-hugeicons-search-01 text-gray-400 text-lg"></i>
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search emails..."
                  class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <!-- Inbox navigation -->
            <div class="flex items-center ml-4">
              <button
                @click="activeFolder = 'inbox'"
                class="flex items-center px-3 py-2 rounded-md text-sm font-medium"
                :class="[
                  activeFolder === 'inbox'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                ]"
              >
                <i class="i-hugeicons-inbox text-lg mr-2"></i>
                Inbox
                <span v-if="inboxUnreadCount > 0" class="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {{ inboxUnreadCount }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Email list and content area -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Email list -->
          <div v-if="!selectedEmail || !isComposing" class="w-full md:w-1/3 lg:w-2/5 border-r border-gray-200 dark:border-blue-gray-600 flex flex-col">
            <div class="bg-white dark:bg-blue-gray-700 py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
              <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                {{ folders.find(f => f.id === activeFolder)?.name || 'All Mail' }}
              </h2>
              <div class="flex space-x-2">
                <button @click="refreshEmails" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
                  <i class="i-hugeicons-refresh text-gray-500 dark:text-gray-400 text-lg" :class="{ 'animate-spin': isRefreshing }"></i>
                </button>
                <div class="relative">
                  <button @click="toggleMoreMenu" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
                    <i class="i-hugeicons-more-vertical-circle-01 text-gray-500 dark:text-gray-400 text-lg"></i>
                  </button>
                  <!-- Dropdown menu -->
                  <div
                    v-if="showMoreMenu"
                    ref="dropdownRef"
                    class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-blue-gray-600 ring-1 ring-black ring-opacity-5 z-10"
                  >
                    <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <a href="/inbox/activity" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-blue-gray-700" role="menuitem">
                        <div class="flex items-center">
                          <i class="i-hugeicons-analytics-up text-lg mr-2"></i>
                          Analytics
                        </div>
                      </a>
                      <a href="/inbox/settings" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-blue-gray-700" role="menuitem">
                        <div class="flex items-center">
                          <i class="i-hugeicons-settings-01 text-lg mr-2"></i>
                          Settings
                        </div>
                      </a>
                    </div>
                  </div>
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
                        <button @click.stop="toggleStar(email.id)" class="text-gray-400 hover:text-yellow-400">
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

          <!-- Empty state when no email is selected -->
          <div v-if="!selectedEmail && !isComposing" class="hidden md:flex md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex-col items-center justify-center p-8">
            <div class="text-center">
              <div class="mx-auto h-24 w-24 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-6">
                <i class="i-hugeicons-mail-02 text-blue-600 dark:text-blue-400 text-5xl"></i>
              </div>
              <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">No message selected</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Select an email from your inbox to view its contents here, or start a new conversation by clicking the compose button.
              </p>
              <button
                @click="handleCompose"
                class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium text-sm"
              >
                <i class="i-hugeicons-plus-sign text-lg mr-2"></i>
                Compose New Email
              </button>
            </div>
          </div>

          <!-- Email detail view -->
          <div v-if="selectedEmail" class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
            <div class="py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <button @click="closeEmail" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
                  <i class="i-hugeicons-arrow-left-02 text-gray-500 dark:text-gray-400 text-lg"></i>
                </button>
                <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ selectedEmail?.subject }}
                </h2>
              </div>
              <div class="flex space-x-2">
                <button @click="selectedEmail && toggleStar(selectedEmail.id)" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600">
                  <span v-if="selectedEmail?.starred" class="text-yellow-400 text-lg">
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
                      {{ selectedEmail?.from.charAt(0) }}
                    </div>
                    <div class="ml-3">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedEmail?.from }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ selectedEmail?.email }}</p>
                    </div>
                  </div>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ selectedEmail?.date ? new Date(selectedEmail.date).toLocaleString() : '' }}
                </div>
              </div>
              <div class="mt-2">
                <p class="text-base font-medium text-gray-900 dark:text-gray-100">{{ selectedEmail?.subject }}</p>
              </div>
            </div>

            <div class="flex-1 p-4 overflow-y-auto">
              <div v-if="selectedEmail?.body" v-html="selectedEmail.body" class="prose dark:prose-invert max-w-none"></div>

              <div v-if="selectedEmail?.attachment" class="mt-4 border border-gray-200 dark:border-blue-gray-600 rounded p-3">
                <div class="flex items-center">
                  <i class="i-hugeicons-file-01 text-gray-500 dark:text-gray-400 text-xl"></i>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Document.pdf</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">1.2 MB</p>
                  </div>
                  <button class="ml-auto p-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800">
                    <i class="i-hugeicons-download text-lg"></i>
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

          <!-- Compose new email view -->
          <div v-if="isComposing" class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
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
                    placeholder="recipient@example.com"
                    class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="subject" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                  <input
                    id="subject"
                    v-model="newEmail.subject"
                    type="text"
                    placeholder="Enter email subject"
                    class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="body" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                  <textarea
                    id="body"
                    v-model="newEmail.body"
                    rows="15"
                    placeholder="Write your message here..."
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
        </div>
      </div>
    </div>
  </div>
</template>
