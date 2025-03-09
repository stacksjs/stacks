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
  labels?: string[] // Add labels for categorization
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
    from: 'William Smith',
    email: 'williamsmith@example.com',
    subject: 'Meeting Tomorrow',
    preview: 'Hi, let\'s have a meeting tomorrow to discuss the project. I\'ve been reviewing the project details and have some ideas I\'d like to share...',
    body: `
      <p>Hi, let's have a meeting tomorrow to discuss the project. I've been reviewing the project details and have some ideas I'd like to share. It's crucial that we align on our next steps to ensure the project's success.</p>
      <p>Please come prepared with any questions or insights you may have. Looking forward to our meeting!</p>
      <p>Best regards,<br>William</p>
    `,
    date: '2023-10-22T09:00:00',
    read: false,
    starred: false,
    folder: 'inbox',
    attachment: false,
    labels: ['meeting', 'work', 'important']
  },
  {
    id: 2,
    from: 'Alice Smith',
    email: 'alice@example.com',
    subject: 'Re: Project Update',
    preview: 'Thank you for the project update. It looks great! I\'ve gone through the report, and the progress is impressive. The team has done a...',
    body: `
      <p>Thank you for the project update. It looks great!</p>
      <p>I've gone through the report, and the progress is impressive. The team has done a fantastic job meeting all the milestones so far.</p>
      <p>Let's discuss the next phase during our weekly meeting.</p>
      <p>Regards,<br>Alice</p>
    `,
    date: '2023-10-20T14:30:00',
    read: true,
    starred: false,
    folder: 'inbox',
    attachment: false,
    labels: ['work', 'important']
  },
  {
    id: 3,
    from: 'Bob Johnson',
    email: 'bob@example.com',
    subject: 'Weekend Plans',
    preview: 'Any plans for the weekend? I was thinking of going hiking in the nearby mountains. It\'s been a while since we had some outdoor fun...',
    body: `
      <p>Hey,</p>
      <p>Any plans for the weekend? I was thinking of going hiking in the nearby mountains. It's been a while since we had some outdoor fun.</p>
      <p>Let me know if you're interested, and we can plan accordingly.</p>
      <p>Cheers,<br>Bob</p>
    `,
    date: '2022-05-15T09:45:00',
    read: true,
    starred: false,
    folder: 'inbox',
    attachment: false,
    labels: ['personal']
  },
  {
    id: 4,
    from: 'Emily Davis',
    email: 'emily@example.com',
    subject: 'Re: Question about Budget',
    preview: 'I have a question about the budget for the upcoming project. It seems like there\'s a discrepancy in the allocation of resources. I\'ve...',
    body: `
      <p>Hello,</p>
      <p>I have a question about the budget for the upcoming project. It seems like there's a discrepancy in the allocation of resources.</p>
      <p>I've noticed that the marketing budget is significantly higher than what we initially discussed. Can we review this together?</p>
      <p>Thanks,<br>Emily</p>
    `,
    date: '2022-05-14T11:20:00',
    read: false,
    starred: false,
    folder: 'inbox',
    attachment: false,
    labels: ['work', 'budget']
  },
  {
    id: 5,
    from: 'Michael Wilson',
    email: 'michael@example.com',
    subject: 'Important Announcement',
    preview: 'I have an important announcement to make during our team meeting. It pertains to a strategic shift in our approach to the project...',
    body: `
      <p>Team,</p>
      <p>I have an important announcement to make during our team meeting. It pertains to a strategic shift in our approach to the project.</p>
      <p>Please ensure everyone attends the meeting tomorrow at 10 AM.</p>
      <p>Best,<br>Michael</p>
    `,
    date: '2022-05-13T15:00:00',
    read: true,
    starred: true,
    folder: 'inbox',
    attachment: false,
    labels: ['meeting', 'work', 'important']
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
  { id: 'inbox', name: 'Inbox', icon: 'inbox' },
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

// Fix the TypeScript error by accessing the value property
const inboxUnreadCount = computed(() => {
  return unreadCounts.value['inbox'] || 0
})
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-blue-gray-800">
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
        <!-- Header with title and actions -->
        <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 py-2 px-4">
          <div class="flex items-center justify-between">
            <!-- Title -->
            <div class="text-xl font-medium text-gray-900 dark:text-white">Inbox</div>

            <!-- Action buttons -->
            <div class="flex items-center space-x-1">
              <div class="flex bg-gray-100 dark:bg-blue-gray-600 rounded-md">
                <button
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white bg-gray-200 dark:bg-blue-gray-500 rounded-md"
                >
                  All mail
                </button>
                <button
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white"
                >
                  Unread
                </button>
              </div>

              <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <i class="i-hugeicons-waste text-lg"></i>
              </button>
              <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <i class="i-hugeicons-archive text-lg"></i>
              </button>
              <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <i class="i-hugeicons-spam text-lg"></i>
              </button>

              <div class="flex items-center ml-2">
                <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                  <i class="i-hugeicons-clock-circle text-lg"></i>
                </button>
                <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                  <i class="i-hugeicons-arrow-left-01 text-lg"></i>
                </button>
                <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                  <i class="i-hugeicons-arrow-right-01 text-lg"></i>
                </button>
                <button class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                  <i class="i-hugeicons-more-vertical-circle text-lg"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Email list and content area -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Email list -->
          <div v-if="!selectedEmail || !isComposing" class="w-full md:w-1/3 lg:w-2/5 border-r border-gray-200 dark:border-blue-gray-600 flex flex-col">
            <!-- Search bar (moved to left section) -->
            <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 px-4 py-2">
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i class="i-hugeicons-search-01 text-gray-400 text-lg"></i>
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search"
                  class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-blue-gray-600 rounded-md bg-gray-50 dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div class="flex-1 overflow-y-auto">
              <ul class="divide-y divide-gray-200 dark:divide-blue-gray-600">
                <li
                  v-for="email in filteredEmails"
                  :key="email.id"
                  @click="openEmail(email)"
                  :class="[
                    'hover:bg-gray-50 dark:hover:bg-blue-gray-600 cursor-pointer',
                    !email.read ? 'bg-white dark:bg-blue-gray-700' : 'bg-white dark:bg-blue-gray-700'
                  ]"
                >
                  <div class="px-4 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ email.from }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ formatDate(email.date) }}
                      </p>
                    </div>
                    <div class="mt-1">
                      <p class="text-sm text-gray-900 dark:text-white">
                        {{ email.subject }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {{ email.preview }}
                      </p>
                    </div>

                    <!-- Email labels/tags -->
                    <div class="mt-2 flex flex-wrap gap-1" v-if="email.labels && email.labels.length > 0">
                      <span
                        v-for="label in email.labels"
                        :key="label"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="{
                          'bg-gray-100 text-gray-800 dark:bg-blue-900 dark:text-blue-200': label === 'work',
                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': label === 'personal',
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': label === 'important',
                          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200': label === 'meeting',
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200': label === 'budget'
                        }"
                      >
                        {{ label }}
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Email detail view with reply box at the bottom -->
          <div v-if="selectedEmail" class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
            <div class="py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <button @click="closeEmail" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-arrow-left-02 text-lg"></i>
                </button>
                <h2 class="text-lg font-medium text-gray-900 dark:text-white">
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
                <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-inbox text-lg"></i>
                </button>
                <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-waste text-lg"></i>
                </button>
              </div>
            </div>

            <!-- Email header with sender info -->
            <div class="px-4 py-3 border-b border-gray-200 dark:border-blue-gray-600">
              <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-500 flex items-center justify-center text-gray-700 dark:text-white font-medium">
                      {{ selectedEmail?.from.charAt(0) }}
                    </div>
                    <div class="ml-3">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedEmail?.from }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ selectedEmail?.email }}</p>
                    </div>
                  </div>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ selectedEmail?.date ? new Date(selectedEmail.date).toLocaleString() : '' }}
                </div>
              </div>
              <div class="mt-2">
                <p class="text-base font-medium text-gray-900 dark:text-white">{{ selectedEmail?.subject }}</p>
              </div>
            </div>

            <!-- Email body -->
            <div class="flex-1 p-4 overflow-y-auto text-gray-900 dark:text-white">
              <div v-if="selectedEmail?.body" v-html="selectedEmail.body" class="prose dark:prose-invert max-w-none"></div>

              <div v-if="selectedEmail?.attachment" class="mt-4 border border-gray-200 dark:border-blue-gray-600 rounded p-3">
                <div class="flex items-center">
                  <i class="i-hugeicons-file-01 text-gray-500 dark:text-gray-400 text-xl"></i>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">Document.pdf</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">1.2 MB</p>
                  </div>
                  <button class="ml-auto p-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800">
                    <i class="i-hugeicons-download text-lg"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Reply box at the bottom (only in the right section) -->
            <div class="bg-white dark:bg-blue-gray-700 border-t border-gray-200 dark:border-blue-gray-600 p-4">
              <div class="flex items-center">
                <textarea
                  placeholder="Reply William Smith..."
                  class="flex-1 bg-white dark:bg-blue-gray-600 border border-gray-300 dark:border-blue-gray-600 rounded-md p-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows="3"
                ></textarea>
              </div>
              <div class="flex justify-between mt-2">
                <div class="flex items-center">
                  <label class="inline-flex items-center text-gray-500 dark:text-gray-400 text-sm">
                    <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-blue-gray-600">
                    <span class="ml-2">Mute this thread</span>
                  </label>
                </div>
                <button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium text-sm">
                  Send
                </button>
              </div>
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

          <!-- Compose new email view -->
          <div v-if="isComposing" class="w-full md:w-2/3 lg:w-3/5 bg-white dark:bg-blue-gray-700 flex flex-col">
            <div class="py-2 px-4 border-b border-gray-200 dark:border-blue-gray-600 flex items-center justify-between">
              <h2 class="text-lg font-medium text-gray-900 dark:text-white">
                New Message
              </h2>
              <button @click="cancelCompose" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                <i class="i-hugeicons-cancel-circle text-lg"></i>
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
                <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-attachment-01 text-lg"></i>
                </button>
                <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-image-01 text-lg"></i>
                </button>
                <button class="p-2 rounded hover:bg-gray-100 dark:hover:bg-blue-gray-600 text-gray-500 dark:text-gray-400">
                  <i class="i-hugeicons-smile text-lg"></i>
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
