<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement } from 'chart.js'

// Register ChartJS components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement)

useHead({
  title: 'Dashboard - Blog Comments',
})

// Chart options
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0
      }
    }
  },
  plugins: {
    legend: {
      position: 'top' as const,
    }
  }
}

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0
      }
    }
  },
  plugins: {
    legend: {
      position: 'top' as const,
    }
  }
}

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    }
  }
}

// Time range selector
const timeRanges = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7days' },
  { label: 'Last 30 days', value: '30days' },
  { label: 'Last 90 days', value: '90days' },
  { label: 'Last year', value: 'year' },
  { label: 'All time', value: 'all' }
]
const selectedTimeRange = ref('30days')

// Define comment type
interface Comment {
  id: number
  content: string
  author: string
  email: string
  postId: number
  postTitle: string
  status: 'approved' | 'pending' | 'spam'
  createdAt: string
}

// Sample comments data
const comments = ref<Comment[]>([
  {
    id: 1,
    content: "This article was incredibly helpful! I've been struggling with this concept for weeks.",
    author: 'Jane Smith',
    email: 'jane.smith@example.com',
    postId: 1,
    postTitle: 'Getting Started with Vue 3',
    status: 'approved',
    createdAt: '2023-11-15T09:24:00',
  },
  {
    id: 2,
    content: 'I disagree with some points in this article. The framework has evolved since this was written.',
    author: 'Michael Johnson',
    email: 'michael.j@example.com',
    postId: 1,
    postTitle: 'Getting Started with Vue 3',
    status: 'approved',
    createdAt: '2023-11-15T10:45:00',
  },
  {
    id: 3,
    content: "Could you provide more examples of this implementation? I'm still confused.",
    author: 'Sarah Williams',
    email: 'sarah.w@example.com',
    postId: 2,
    postTitle: 'Advanced TypeScript Patterns',
    status: 'pending',
    createdAt: '2023-11-16T14:12:00',
  },
  {
    id: 4,
    content: 'Check out my website for more information on this topic! www.spam-link.com',
    author: 'Spam Bot',
    email: 'spammer@example.com',
    postId: 3,
    postTitle: 'Building Responsive Layouts',
    status: 'spam',
    createdAt: '2023-11-16T15:30:00',
  },
  {
    id: 5,
    content: "I've implemented this solution and it works perfectly. Thanks for sharing!",
    author: 'David Brown',
    email: 'david.b@example.com',
    postId: 2,
    postTitle: 'Advanced TypeScript Patterns',
    status: 'approved',
    createdAt: '2023-11-17T08:15:00',
  },
  {
    id: 6,
    content: 'This is exactly what I needed to solve my problem. Great explanation!',
    author: 'Emily Chen',
    email: 'emily.c@example.com',
    postId: 4,
    postTitle: 'State Management in Modern Web Apps',
    status: 'approved',
    createdAt: '2023-11-17T11:42:00',
  },
  {
    id: 7,
    content: 'I found a typo in the third paragraph. It should be "their" not "there".',
    author: 'Grammar Police',
    email: 'grammar@example.com',
    postId: 5,
    postTitle: 'CSS Grid vs Flexbox',
    status: 'approved',
    createdAt: '2023-11-18T09:05:00',
  },
  {
    id: 8,
    content: 'Buy cheap products now! Discount code: SPAM123',
    author: 'Marketing Spammer',
    email: 'spam@example.com',
    postId: 6,
    postTitle: 'JavaScript Performance Tips',
    status: 'spam',
    createdAt: '2023-11-18T16:20:00',
  },
  {
    id: 9,
    content: 'Have you considered exploring the new features in the beta release?',
    author: 'Tech Enthusiast',
    email: 'tech@example.com',
    postId: 7,
    postTitle: 'The Future of Web Development',
    status: 'pending',
    createdAt: '2023-11-19T10:30:00',
  },
  {
    id: 10,
    content: "I'm having trouble with the code in step 4. Could you clarify?",
    author: 'Beginner Coder',
    email: 'newbie@example.com',
    postId: 8,
    postTitle: 'Building Your First API',
    status: 'pending',
    createdAt: '2023-11-19T14:50:00',
  },
  {
    id: 11,
    content: 'Your explanation of closures finally made it click for me. Thank you!',
    author: 'Grateful Reader',
    email: 'grateful@example.com',
    postId: 9,
    postTitle: 'Understanding JavaScript Closures',
    status: 'approved',
    createdAt: '2023-11-20T08:25:00',
  },
  {
    id: 12,
    content: "I've been following your blog for years and this is one of your best articles yet.",
    author: 'Loyal Fan',
    email: 'loyal@example.com',
    postId: 10,
    postTitle: 'Optimizing React Applications',
    status: 'approved',
    createdAt: '2023-11-20T13:15:00',
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('createdAt')
const sortOrder = ref('desc')
const statusFilter = ref('all')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// Edit Comment Modal
const showEditModal = ref(false)
const commentToEdit = ref<Comment | null>(null)

// Delete Confirmation Modal
const showDeleteModal = ref(false)
const commentToDelete = ref<Comment | null>(null)
const selectedCommentIds = ref<number[]>([])
const selectAll = ref(false)

// Computed properties
const filteredComments = computed(() => {
  let result = [...comments.value]

  // Apply status filter
  if (statusFilter.value !== 'all') {
    result = result.filter(comment => comment.status === statusFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(comment =>
      comment.content.toLowerCase().includes(query) ||
      comment.author.toLowerCase().includes(query) ||
      comment.email.toLowerCase().includes(query) ||
      comment.postTitle.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result.sort((a, b) => {
    const sortField = sortBy.value as keyof Comment
    let aValue = a[sortField]
    let bValue = b[sortField]

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (sortOrder.value === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  return result
})

// Pagination
const totalPages = computed(() => Math.ceil(filteredComments.value.length / itemsPerPage.value))

const paginatedComments = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredComments.value.slice(startIndex, endIndex)
})

const paginationRange = computed(() => {
  const range: number[] = []
  const maxVisiblePages = 5
  const startPage = Math.max(1, currentPage.value - Math.floor(maxVisiblePages / 2))
  const endPage = Math.min(totalPages.value, startPage + maxVisiblePages - 1)

  for (let i = startPage; i <= endPage; i++) {
    range.push(i)
  }

  return range
})

// Methods
function openEditModal(comment: Comment): void {
  commentToEdit.value = { ...comment }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
}

function updateComment(): void {
  if (!commentToEdit.value) return

  const index = comments.value.findIndex(c => c.id === commentToEdit.value!.id)
  if (index !== -1) {
    comments.value[index] = { ...commentToEdit.value }
  }

  closeEditModal()
}

function confirmDeleteComment(comment: Comment): void {
  commentToDelete.value = comment
  selectedCommentIds.value = []
  showDeleteModal.value = true
}

function confirmDeleteSelected(): void {
  showDeleteModal.value = true
}

function closeDeleteModal(): void {
  showDeleteModal.value = false
  commentToDelete.value = null
}

function deleteSelectedComments(): void {
  if (selectedCommentIds.value.length > 1) {
    // Delete multiple comments
    comments.value = comments.value.filter(comment => !selectedCommentIds.value.includes(comment.id))
    selectedCommentIds.value = []
  } else if (commentToDelete.value) {
    // Delete single comment
    comments.value = comments.value.filter(comment => comment.id !== commentToDelete.value!.id)
  }

  closeDeleteModal()
}

function toggleSelectAll(): void {
  if (selectAll.value) {
    // Select all comments on current page
    selectedCommentIds.value = paginatedComments.value.map(comment => comment.id)
  } else {
    // Deselect all
    selectedCommentIds.value = []
  }
}

function toggleCommentSelection(commentId: number): void {
  const index = selectedCommentIds.value.indexOf(commentId)
  if (index === -1) {
    selectedCommentIds.value.push(commentId)
  } else {
    selectedCommentIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all comments are selected
  selectAll.value = paginatedComments.value.every(comment => selectedCommentIds.value.includes(comment.id))
}

function updateCommentStatus(comment: Comment, newStatus: 'approved' | 'pending' | 'spam'): void {
  const index = comments.value.findIndex(c => c.id === comment.id)
  if (index !== -1) {
    comments.value[index] = { ...comment, status: newStatus }
  }
}

function bulkUpdateStatus(newStatus: 'approved' | 'pending' | 'spam'): void {
  for (const id of selectedCommentIds.value) {
    const comment = comments.value.find(c => c.id === id)
    if (comment) {
      updateCommentStatus(comment, newStatus)
    }
  }
  selectedCommentIds.value = []
}

const hasSelectedComments = computed(() => selectedCommentIds.value.length > 0)

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Truncate text for display
function truncateText(text: string, max: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Monthly chart data
const monthlyChartData = computed(() => {
  // Generate sample data for comments over time
  const commentsByMonth = [8, 12, 15, 10, 18, 22, 16, 14, 20, 25, 30, 28]
  const approvedByMonth = [6, 10, 12, 8, 15, 18, 14, 12, 16, 20, 24, 22]
  const pendingByMonth = [1, 1, 2, 1, 2, 2, 1, 1, 2, 3, 4, 3]
  const spamByMonth = [1, 1, 1, 1, 1, 2, 1, 1, 2, 2, 2, 3]

  const commentsOverTimeData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Total Comments',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        data: commentsByMonth
      }
    ]
  }

  // Generate sample data for comments by status
  const commentsByStatusData = {
    labels: ['Approved', 'Pending', 'Spam'],
    datasets: [
      {
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1,
        data: [
          comments.value.filter(c => c.status === 'approved').length,
          comments.value.filter(c => c.status === 'pending').length,
          comments.value.filter(c => c.status === 'spam').length
        ]
      }
    ]
  }

  // Generate sample data for comments by post
  const topPosts = [...new Set(comments.value.map(c => c.postTitle))]
    .slice(0, 5)
    .map(title => {
      return {
        title,
        count: comments.value.filter(c => c.postTitle === title).length
      }
    })
    .sort((a, b) => b.count - a.count)

  const commentsByPostData = {
    labels: topPosts.map(p => p.title),
    datasets: [
      {
        label: 'Comments',
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
        data: topPosts.map(p => p.count)
      }
    ]
  }

  return {
    commentsOverTimeChartData: commentsOverTimeData,
    commentsByStatusChartData: commentsByStatusData,
    commentsByPostChartData: commentsByPostData
  }
})

// Comment statistics
const commentStats = computed(() => {
  const totalComments = comments.value.length
  const approvedComments = comments.value.filter(c => c.status === 'approved').length
  const pendingComments = comments.value.filter(c => c.status === 'pending').length
  const spamComments = comments.value.filter(c => c.status === 'spam').length

  // Calculate approval rate
  const approvalRate = totalComments > 0 ? Math.round((approvedComments / totalComments) * 100) : 0

  // Find most active author
  const authorCounts = comments.value.reduce((acc, comment) => {
    acc[comment.author] = (acc[comment.author] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostActiveAuthor = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([author, count]) => ({ author, count }))[0] || { author: 'None', count: 0 }

  // Find most commented post
  const postCounts = comments.value.reduce((acc, comment) => {
    acc[comment.postTitle] = (acc[comment.postTitle] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostCommentedPost = Object.entries(postCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => ({ title, count }))[0] || { title: 'None', count: 0 }

  // Find newest comment
  const sortedComments = [...comments.value].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const newestComment = sortedComments[0] || null

  return {
    totalComments,
    approvedComments,
    pendingComments,
    spamComments,
    approvalRate,
    mostActiveAuthor,
    mostCommentedPost,
    newestComment
  }
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Comments</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage all your blog comments
            </p>
          </div>
        </div>

        <!-- Time Range Selector -->
        <div class="mt-6 flex justify-end">
          <div class="relative inline-block w-full sm:w-auto">
            <select
              v-model="selectedTimeRange"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="range in timeRanges" :key="range.value" :value="range.value">{{ range.label }}</option>
            </select>
          </div>
        </div>

        <!-- Comment Statistics -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total Comments -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                  <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Comments
                    </dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ commentStats.totalComments }}
                      </div>
                      <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span class="text-green-600 dark:text-green-400">{{ commentStats.approvedComments }}</span> approved,
                        <span class="text-yellow-600 dark:text-yellow-400">{{ commentStats.pendingComments }}</span> pending,
                        <span class="text-red-600 dark:text-red-400">{{ commentStats.spamComments }}</span> spam
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Approval Rate -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Approval Rate
                    </dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ commentStats.approvalRate }}%
                      </div>
                      <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{{ commentStats.approvedComments }} of {{ commentStats.totalComments }} comments</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Most Active Author -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-purple-500 rounded-md p-3">
                  <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Most Active Author
                    </dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ commentStats.mostActiveAuthor.author }}
                      </div>
                      <div class="mt-1 text-sm text-green-600 dark:text-green-400">
                        <span>{{ commentStats.mostActiveAuthor.count }} comments</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Most Commented Post -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Most Commented Post
                    </dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white line-clamp-1">
                        {{ commentStats.mostCommentedPost.title }}
                      </div>
                      <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{{ commentStats.mostCommentedPost.count }} comments</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts -->
        <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <!-- Comments Over Time Chart -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Comments Over Time</h3>
              <div class="mt-4" style="height: 250px;">
                <Line :data="monthlyChartData.commentsOverTimeChartData" :options="lineChartOptions" />
              </div>
            </div>
          </div>

          <!-- Comments by Status Chart -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Comments by Status</h3>
              <div class="mt-4" style="height: 250px;">
                <Doughnut :data="monthlyChartData.commentsByStatusChartData" :options="doughnutChartOptions" />
              </div>
            </div>
          </div>

          <!-- Comments by Post Chart -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Top Posts by Comments</h3>
              <div class="mt-4" style="height: 250px;">
                <Bar :data="monthlyChartData.commentsByPostChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search comments..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="spam">Spam</option>
            </select>

            <select
              v-model="sortBy"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="createdAt">Sort by Date</option>
              <option value="author">Sort by Author</option>
              <option value="postTitle">Sort by Post</option>
            </select>

            <select
              v-model="sortOrder"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>

            <select
              v-model="itemsPerPage"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option :value="5">5 per page</option>
              <option :value="10">10 per page</option>
              <option :value="25">25 per page</option>
              <option :value="50">50 per page</option>
            </select>
          </div>
        </div>

        <!-- Bulk actions -->
        <div v-if="hasSelectedComments" class="mt-4 bg-blue-50 p-4 rounded-lg shadow-sm dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-800 dark:text-blue-300">{{ selectedCommentIds.length }} comments selected</span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="bulkUpdateStatus('approved')"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-green-600 shadow-sm ring-1 ring-inset ring-green-300 hover:bg-green-50 dark:bg-blue-gray-800 dark:text-green-400 dark:ring-green-500/30 dark:hover:bg-green-500/10"
              >
                <div class="i-hugeicons-check h-4 w-4 mr-1"></div>
                Approve
              </button>
              <button
                @click="bulkUpdateStatus('pending')"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-yellow-600 shadow-sm ring-1 ring-inset ring-yellow-300 hover:bg-yellow-50 dark:bg-blue-gray-800 dark:text-yellow-400 dark:ring-yellow-500/30 dark:hover:bg-yellow-500/10"
              >
                <div class="i-hugeicons-clock-01 h-4 w-4 mr-1"></div>
                Mark as Pending
              </button>
              <button
                @click="bulkUpdateStatus('spam')"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-orange-600 shadow-sm ring-1 ring-inset ring-orange-300 hover:bg-orange-50 dark:bg-blue-gray-800 dark:text-orange-400 dark:ring-orange-500/30 dark:hover:bg-orange-500/10"
              >
                <div class="i-hugeicons-flag h-4 w-4 mr-1"></div>
                Mark as Spam
              </button>
              <button
                @click="confirmDeleteSelected"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 dark:bg-blue-gray-800 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
              >
                <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Comments Table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Comments</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all blog comments including content, author, post, status, and date.
            </p>
          </div>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow">
            <div class="overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="relative px-4 sm:px-6 py-3.5">
                      <input
                        type="checkbox"
                        :checked="selectAll"
                        @change="toggleSelectAll"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                      />
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Comment
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Author
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Post
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Status
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Date
                    </th>
                    <th scope="col" class="relative px-4 py-3.5">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="comment in paginatedComments" :key="comment.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                    <td class="relative px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          :checked="selectedCommentIds.includes(comment.id)"
                          @change="toggleCommentSelection(comment.id)"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-4">
                      <div class="text-sm text-gray-900 dark:text-white max-w-xs">
                        {{ truncateText(comment.content, 100) }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="flex flex-col">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ comment.author }}
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                          {{ comment.email }}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-500 dark:text-gray-300">
                        {{ comment.postTitle }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <span
                        :class="[
                          'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                          comment.status === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30' :
                          comment.status === 'pending' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-500/30' :
                          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-500/30'
                        ]"
                      >
                        {{ comment.status.charAt(0).toUpperCase() + comment.status.slice(1) }}
                      </span>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-500 dark:text-gray-300">
                        {{ formatDate(comment.createdAt) }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button
                          v-if="comment.status !== 'approved'"
                          @click="updateCommentStatus(comment, 'approved')"
                          class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Approve"
                        >
                          <div class="i-hugeicons-check h-5 w-5"></div>
                          <span class="sr-only">Approve</span>
                        </button>
                        <button
                          v-if="comment.status !== 'pending'"
                          @click="updateCommentStatus(comment, 'pending')"
                          class="text-gray-400 transition-colors duration-150 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Mark as Pending"
                        >
                          <div class="i-hugeicons-clock-01 h-5 w-5"></div>
                          <span class="sr-only">Mark as Pending</span>
                        </button>
                        <button
                          v-if="comment.status !== 'spam'"
                          @click="updateCommentStatus(comment, 'spam')"
                          class="text-gray-400 transition-colors duration-150 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                          title="Mark as Spam"
                        >
                          <div class="i-hugeicons-flag-02 h-5 w-5"></div>
                          <span class="sr-only">Mark as Spam</span>
                        </button>
                        <button
                          @click="openEditModal(comment)"
                          class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          <span class="sr-only">Edit</span>
                        </button>
                        <button
                          @click="confirmDeleteComment(comment)"
                          class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <div class="i-hugeicons-waste h-5 w-5"></div>
                          <span class="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedComments.length === 0">
                    <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No comments found. Try adjusting your search or filters.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="currentPage = Math.max(1, currentPage - 1)"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700"
            >
              Previous
            </button>
            <button
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing <span class="font-medium">{{ ((currentPage - 1) * itemsPerPage) + 1 }}</span> to <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredComments.length) }}</span> of <span class="font-medium">{{ filteredComments.length }}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:text-gray-500 dark:hover:bg-blue-gray-700"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>
                <button
                  v-for="page in paginationRange"
                  :key="page"
                  @click="currentPage = page"
                  :class="[
                    page === currentPage
                      ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                      : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-700'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:text-gray-500 dark:hover:bg-blue-gray-700"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Edit Comment Modal -->
  <div v-if="showEditModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeEditModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-edit-01 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">Edit Comment</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Update the comment details.
                </p>
              </div>
            </div>
          </div>
          <div v-if="commentToEdit" class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <div>
                <label for="edit-comment-content" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Content</label>
                <div class="mt-2">
                  <textarea
                    id="edit-comment-content"
                    v-model="commentToEdit.content"
                    rows="4"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  ></textarea>
                </div>
              </div>
              <div>
                <label for="edit-comment-author" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Author</label>
                <div class="mt-2">
                  <input
                    type="text"
                    id="edit-comment-author"
                    v-model="commentToEdit.author"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div>
                <label for="edit-comment-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Email</label>
                <div class="mt-2">
                  <input
                    type="email"
                    id="edit-comment-email"
                    v-model="commentToEdit.email"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div>
                <label for="edit-comment-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Status</label>
                <div class="mt-2">
                  <select
                    id="edit-comment-status"
                    v-model="commentToEdit.status"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="spam">Spam</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="updateComment"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
              :disabled="!commentToEdit"
            >
              Update
            </button>
            <button
              type="button"
              @click="closeEditModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div v-if="showDeleteModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeDeleteModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-red-900/30">
              <div class="i-hugeicons-exclamation-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">
                {{ selectedCommentIds.length > 1 ? 'Delete Comments' : 'Delete Comment' }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ selectedCommentIds.length > 1
                    ? `Are you sure you want to delete these ${selectedCommentIds.length} comments? This action cannot be undone.`
                    : 'Are you sure you want to delete this comment? This action cannot be undone.'
                  }}
                </p>
                <div v-if="selectedCommentIds.length > 1" class="mt-4 max-h-40 overflow-y-auto">
                  <ul class="space-y-2">
                    <li v-for="id in selectedCommentIds" :key="id" class="text-sm text-gray-700 dark:text-gray-300">
                      {{ truncateText(comments.find((c: Comment) => c.id === id)?.content || '', 50) }}
                    </li>
                  </ul>
                </div>
                <div v-else-if="commentToDelete" class="mt-4">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ truncateText(commentToDelete.content, 100) }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">by {{ commentToDelete.author }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="deleteSelectedComments"
              class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:ml-3 sm:w-auto"
            >
              Delete
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
