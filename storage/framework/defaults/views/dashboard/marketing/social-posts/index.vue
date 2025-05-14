<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Social Media Posts',
})

// Define post type
interface SocialPost {
  id: number
  content: string
  images: string[]
  platform: string
  status: string
  scheduledDate: string
  publishedDate: string | null
  author: string
  authorAvatar: string
  likes: number
  reposts: number
  replies: number
  engagement: number
  tags: string[]
  isThreadStarter: boolean
  threadId: number | null
  threadSize: number
}

// Sample posts data
const posts = ref<SocialPost[]>([
  {
    id: 1,
    content: "Just launched our new summer menu! Come try our refreshing new salads and smoothies. Perfect for the hot weather! #SummerMenu #HealthyEating",
    images: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Published",
    scheduledDate: "2023-06-15T10:00:00",
    publishedDate: "2023-06-15T10:00:00",
    author: "Marketing Team",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    likes: 28,
    reposts: 12,
    replies: 5,
    engagement: 4.5,
    tags: ["SummerMenu", "HealthyEating"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  },
  {
    id: 2,
    content: "We're excited to announce our partnership with local farmers to bring you the freshest ingredients possible! Supporting local has always been our priority. #LocalFarmers #FarmToTable",
    images: ["https://images.unsplash.com/photo-1595855759920-86582396756a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Scheduled",
    scheduledDate: "2023-07-01T09:30:00",
    publishedDate: null,
    author: "Marketing Team",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["LocalFarmers", "FarmToTable"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  },
  {
    id: 3,
    content: "Thread: Our chef's journey to creating the perfect burger (1/4)\n\nIt all started with a passion for quality ingredients and the perfect bun-to-patty ratio. #BurgerStory #CulinaryJourney",
    images: ["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Draft",
    scheduledDate: "2023-07-05T12:00:00",
    publishedDate: null,
    author: "Chef Michael",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["BurgerStory", "CulinaryJourney"],
    isThreadStarter: true,
    threadId: 101,
    threadSize: 4
  },
  {
    id: 4,
    content: "Thread: Our chef's journey to creating the perfect burger (2/4)\n\nThe search for the perfect blend of beef cuts took months of experimentation. We settled on a mix of chuck, brisket, and short rib. #BurgerStory #BeefBlend",
    images: [],
    platform: "Bluesky",
    status: "Draft",
    scheduledDate: "2023-07-05T12:05:00",
    publishedDate: null,
    author: "Chef Michael",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["BurgerStory", "BeefBlend"],
    isThreadStarter: false,
    threadId: 101,
    threadSize: 4
  },
  {
    id: 5,
    content: "Join us this weekend for our special brunch menu! Mimosas included with every order. Reservations recommended. #WeekendBrunch #Mimosas",
    images: ["https://images.unsplash.com/photo-1533089860892-a9c9f5a37eb5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Failed",
    scheduledDate: "2023-06-20T08:00:00",
    publishedDate: null,
    author: "Marketing Team",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["WeekendBrunch", "Mimosas"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  },
  {
    id: 6,
    content: "Customer appreciation week starts tomorrow! Enjoy 15% off all orders and a free dessert with purchases over $30. Thank you for your continued support! #CustomerAppreciation #FreeDesert",
    images: ["https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Published",
    scheduledDate: "2023-06-25T11:00:00",
    publishedDate: "2023-06-25T11:00:00",
    author: "Marketing Team",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    likes: 45,
    reposts: 23,
    replies: 15,
    engagement: 8.3,
    tags: ["CustomerAppreciation", "FreeDesert"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  },
  {
    id: 7,
    content: "We're hiring! Looking for passionate chefs and servers to join our team. Competitive pay and benefits. Send your resume to careers@ourrestaurant.com #NowHiring #RestaurantJobs",
    images: [],
    platform: "Bluesky",
    status: "Scheduled",
    scheduledDate: "2023-07-10T14:00:00",
    publishedDate: null,
    author: "HR Team",
    authorAvatar: "https://randomuser.me/api/portraits/men/67.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["NowHiring", "RestaurantJobs"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  },
  {
    id: 8,
    content: "Thread: Our chef's journey to creating the perfect burger (3/4)\n\nThe secret to our juicy burgers? We cook them sous vide before finishing them on a blazing hot grill. #BurgerStory #CookingTechniques",
    images: [],
    platform: "Bluesky",
    status: "Draft",
    scheduledDate: "2023-07-05T12:10:00",
    publishedDate: null,
    author: "Chef Michael",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["BurgerStory", "CookingTechniques"],
    isThreadStarter: false,
    threadId: 101,
    threadSize: 4
  },
  {
    id: 9,
    content: "Thread: Our chef's journey to creating the perfect burger (4/4)\n\nCome try the result of our journey - The Ultimate Burger - available now for a limited time! #BurgerStory #LimitedTimeOffer",
    images: ["https://images.unsplash.com/photo-1565299507177-b0ac66763828?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Draft",
    scheduledDate: "2023-07-05T12:15:00",
    publishedDate: null,
    author: "Chef Michael",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: ["BurgerStory", "LimitedTimeOffer"],
    isThreadStarter: false,
    threadId: 101,
    threadSize: 4
  },
  {
    id: 10,
    content: "Happy hour just got happier! Join us Monday-Friday from 4-6pm for half-price appetizers and $5 signature cocktails. #HappyHour #Cocktails",
    images: ["https://images.unsplash.com/photo-1551024709-8f23befc6f87?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80"],
    platform: "Bluesky",
    status: "Published",
    scheduledDate: "2023-06-10T16:00:00",
    publishedDate: "2023-06-10T16:00:00",
    author: "Marketing Team",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    likes: 37,
    reposts: 18,
    replies: 8,
    engagement: 6.3,
    tags: ["HappyHour", "Cocktails"],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('scheduledDate')
const sortOrder = ref('desc')
const statusFilter = ref('all')
const platformFilter = ref('all')
const authorFilter = ref('all')
const viewMode = ref('compact') // 'detailed' or 'compact'

// Available statuses
const statuses = ['all', 'Published', 'Scheduled', 'Draft', 'Failed']

// Available platforms
const platforms = ['all', 'Bluesky', 'Twitter', 'Instagram', 'Facebook']

// Get unique authors from posts
const authors = computed(() => {
  const uniqueAuthors = new Set(['all'])
  posts.value.forEach(post => uniqueAuthors.add(post.author))
  return Array.from(uniqueAuthors)
})

// Computed filtered and sorted posts
const filteredPosts = computed(() => {
  return posts.value
    .filter(post => {
      // Apply search filter
      const matchesSearch =
        post.content.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
        post.author.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || post.status === statusFilter.value

      // Apply platform filter
      const matchesPlatform = platformFilter.value === 'all' || post.platform === platformFilter.value

      // Apply author filter
      const matchesAuthor = authorFilter.value === 'all' || post.author === authorFilter.value

      return matchesSearch && matchesStatus && matchesPlatform && matchesAuthor
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'scheduledDate') {
        comparison = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      } else if (sortBy.value === 'engagement') {
        comparison = a.engagement - b.engagement
      } else if (sortBy.value === 'author') {
        comparison = a.author.localeCompare(b.author)
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredPosts.value.length / itemsPerPage.value))

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredPosts.value.slice(start, end)
})

function changePage(page: number): void {
  currentPage.value = page
}

function previousPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'desc'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Published':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Draft':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Failed':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format date
function formatDate(date: string | null): string {
  if (!date) return 'N/A';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(date).toLocaleDateString(undefined, options);
}

// Modal state for editing post
const showPostModal = ref(false)
const currentPost = ref<SocialPost | null>(null)
const isNewPost = ref(false)

function openNewPostModal(): void {
  currentPost.value = {
    id: Math.max(...posts.value.map(p => p.id)) + 1,
    content: '',
    images: [],
    platform: 'Bluesky',
    status: 'Draft',
    scheduledDate: new Date().toISOString(),
    publishedDate: null,
    author: 'Marketing Team',
    authorAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0,
    tags: [],
    isThreadStarter: false,
    threadId: null,
    threadSize: 0
  }
  isNewPost.value = true
  showPostModal.value = true
}

function openEditPostModal(post: SocialPost): void {
  currentPost.value = { ...post }
  isNewPost.value = false
  showPostModal.value = true
}

function closePostModal(): void {
  showPostModal.value = false
}

function savePost(): void {
  if (!currentPost.value) return

  if (isNewPost.value) {
    // Add new post
    posts.value.push({ ...currentPost.value })
  } else {
    // Update existing post
    const index = posts.value.findIndex(p => p.id === currentPost.value!.id)
    if (index !== -1) {
      posts.value[index] = { ...currentPost.value }
    }
  }

  closePostModal()
}

// Delete post
function deletePost(postId: number): void {
  const index = posts.value.findIndex(p => p.id === postId)
  if (index !== -1) {
    posts.value.splice(index, 1)
  }
}

// Duplicate post
function duplicatePost(post: SocialPost): void {
  const newPost = {
    ...post,
    id: Math.max(...posts.value.map(p => p.id)) + 1,
    status: 'Draft',
    publishedDate: null,
    likes: 0,
    reposts: 0,
    replies: 0,
    engagement: 0
  }
  posts.value.push(newPost)
}

// Calculate summary statistics
const totalPosts = computed(() => posts.value.length)
const publishedPosts = computed(() => posts.value.filter(p => p.status === 'Published').length)
const scheduledPosts = computed(() => posts.value.filter(p => p.status === 'Scheduled').length)
const draftPosts = computed(() => posts.value.filter(p => p.status === 'Draft').length)

// Extract tags from content
function extractTags(content: string): string[] {
  const tags: string[] = []
  const matches = content.match(/#[a-zA-Z0-9]+/g)
  if (matches) {
    matches.forEach(tag => {
      tags.push(tag.substring(1)) // Remove the # symbol
    })
  }
  return tags
}

// Update tags when content changes
function updateTags(): void {
  if (currentPost.value) {
    currentPost.value.tags = extractTags(currentPost.value.content)
  }
}

// Create thread from selected posts
function createThread(posts: SocialPost[]): void {
  if (posts.length < 2) return

  const threadId = Date.now()
  posts.forEach((post, index) => {
    post.threadId = threadId
    post.isThreadStarter = index === 0
    post.threadSize = posts.length
  })
}

// Get thread posts
function getThreadPosts(threadId: number): SocialPost[] {
  return posts.value.filter(post => post.threadId === threadId)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
}

// Check if post is part of a thread
function isPartOfThread(post: SocialPost): boolean {
  return post.threadId !== null
}

// Add image to post
function addImageToPost(url: string): void {
  if (currentPost.value && currentPost.value.images.length < 4) {
    currentPost.value.images.push(url)
  }
}

// Remove image from post
function removeImageFromPost(index: number): void {
  if (currentPost.value) {
    currentPost.value.images.splice(index, 1)
  }
}

// Truncate text for display
function truncateText(text: string, max: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Social Media Posts</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Create, schedule, and manage your social media posts for Bluesky
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              @click="openNewPostModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2"></div>
              New Post
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total posts card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-document-validation h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Posts</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalPosts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Published posts card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Published</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ publishedPosts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Scheduled posts card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-clock-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ scheduledPosts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Draft posts card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-yellow-100 p-2 dark:bg-yellow-900">
                    <div class="i-hugeicons-edit-01 h-6 w-6 text-yellow-600 dark:text-yellow-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Drafts</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ draftPosts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters and view options -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search posts..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Status filter -->
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Statuses</option>
              <option v-for="status in statuses.slice(1)" :key="status" :value="status">
                {{ status }}
              </option>
            </select>

            <!-- Platform filter -->
            <select
              v-model="platformFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Platforms</option>
              <option v-for="platform in platforms.slice(1)" :key="platform" :value="platform">
                {{ platform }}
              </option>
            </select>

            <!-- Author filter -->
            <select
              v-model="authorFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Authors</option>
              <option v-for="author in authors.slice(1)" :key="author" :value="author">
                {{ author }}
              </option>
            </select>

            <!-- View mode toggle -->
            <div class="flex rounded-md shadow-sm">
              <button
                type="button"
                @click="viewMode = 'detailed'"
                :class="[
                  'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-grid h-5 w-5"></div>
              </button>
              <button
                type="button"
                @click="viewMode = 'compact'"
                :class="[
                  'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'compact'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-list-view h-5 w-5"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Sort options -->
        <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span class="mr-2">Sort by:</span>
          <button
            @click="toggleSort('scheduledDate')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'scheduledDate' }"
          >
            Date
            <span v-if="sortBy === 'scheduledDate'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('engagement')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'engagement' }"
          >
            Engagement
            <span v-if="sortBy === 'engagement'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('author')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'author' }"
          >
            Author
            <span v-if="sortBy === 'author'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Detailed view -->
        <div v-if="viewMode === 'detailed'" class="mt-6">
          <div v-if="paginatedPosts.length === 0" class="py-12 text-center">
            <div class="i-hugeicons-document-validation mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No posts found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter to find what you're looking for.</p>
          </div>

          <div v-else class="space-y-6">
            <!-- Post card -->
            <div
              v-for="post in paginatedPosts"
              :key="post.id"
              class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-blue-gray-800"
            >
              <div class="p-6">
                <div class="flex items-start justify-between">
                  <!-- Author info and platform -->
                  <div class="flex items-start space-x-4">
                    <img
                      :src="post.authorAvatar"
                      :alt="post.author"
                      class="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 class="text-base font-medium text-gray-900 dark:text-white">{{ post.author }}</h3>
                      <div class="mt-1 flex items-center">
                        <span
                          class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {{ post.platform }}
                        </span>
                        <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(post.scheduledDate) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Status badge and thread info -->
                  <div class="flex flex-col items-end space-y-2">
                    <span
                      :class="[getStatusClass(post.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']"
                    >
                      {{ post.status }}
                    </span>
                    <span
                      v-if="isPartOfThread(post)"
                      class="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400 w-fit"
                    >
                      Thread {{ post.isThreadStarter ? '(Starter)' : '' }}
                    </span>
                  </div>
                </div>

                <!-- Post content -->
                <div class="mt-4">
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ post.content }}</p>
                </div>

                <!-- Post images -->
                <div v-if="post.images.length > 0" class="mt-4">
                  <div class="grid grid-cols-2 gap-2">
                    <div
                      v-for="(image, index) in post.images"
                      :key="index"
                      class="relative aspect-square overflow-hidden rounded-lg"
                    >
                      <img
                        :src="image"
                        :alt="`Image ${index + 1}`"
                        class="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <!-- Tags -->
                <div v-if="post.tags.length > 0" class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="tag in post.tags"
                    :key="tag"
                    class="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300"
                  >
                    #{{ tag }}
                  </span>
                </div>

                <!-- Engagement metrics (only for published posts) -->
                <div v-if="post.status === 'Published'" class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div class="i-hugeicons-heart h-4 w-4 mr-1"></div>
                    <span>{{ post.likes }} likes</span>
                  </div>
                  <div class="ml-4 flex items-center">
                    <div class="i-hugeicons-refresh-02 h-4 w-4 mr-1"></div>
                    <span>{{ post.reposts }} reposts</span>
                  </div>
                  <div class="ml-4 flex items-center">
                    <div class="i-hugeicons-bubble-chat h-4 w-4 mr-1"></div>
                    <span>{{ post.replies }} replies</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="mt-4 flex justify-end space-x-3">
                  <button
                    v-if="post.status === 'Draft' || post.status === 'Scheduled'"
                    class="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    <div class="i-hugeicons-paper-plane h-4 w-4 mr-1"></div>
                    Publish Now
                  </button>
                  <button
                    @click="duplicatePost(post)"
                    class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-copy h-4 w-4 mr-1"></div>
                    Duplicate
                  </button>
                  <button
                    @click="openEditPostModal(post)"
                    class="rounded-md bg-white p-1.5 text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                    title="Edit post"
                  >
                    <div class="i-hugeicons-edit-01 h-4 w-4"></div>
                    <span class="sr-only">Edit</span>
                  </button>
                  <button
                    @click="deletePost(post.id)"
                    class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Compact view -->
        <div v-if="viewMode === 'compact'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Content</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Platform</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Author</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedPosts.length === 0">
                <td colspan="6" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No posts found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="post in paginatedPosts" :key="post.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center max-w-md">
                    <div v-if="post.images && post.images.length > 0" class="h-10 w-10 flex-shrink-0 mr-3">
                      <img :src="post.images[0]" alt="Post image" class="h-10 w-10 rounded-md object-cover" />
                    </div>
                    <div v-else class="h-10 w-10 flex-shrink-0 mr-3 bg-blue-100 dark:bg-blue-900 rounded-md flex items-center justify-center">
                      <div class="i-hugeicons-bubble-chat h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                    </div>
                    <div class="truncate text-gray-900 dark:text-white">{{ post.content }}</div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div class="flex items-center">
                    <div v-if="post.platform === 'Bluesky'" class="i-hugeicons-cloud h-5 w-5 text-blue-500 mr-1.5"></div>
                    <div v-else-if="post.platform === 'Twitter'" class="i-hugeicons-twitter h-5 w-5 text-blue-400 mr-1.5"></div>
                    <div v-else-if="post.platform === 'Instagram'" class="i-hugeicons-instagram h-5 w-5 text-pink-500 mr-1.5"></div>
                    <div v-else-if="post.platform === 'Facebook'" class="i-hugeicons-facebook h-5 w-5 text-blue-600 mr-1.5"></div>
                    <div v-else-if="post.platform === 'LinkedIn'" class="i-hugeicons-linkedin h-5 w-5 text-blue-700 mr-1.5"></div>
                    <div class="text-gray-900 dark:text-white">{{ post.platform }}</div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div class="flex items-center">
                    <div class="h-8 w-8 flex-shrink-0">
                      <img :src="post.authorAvatar" :alt="post.author" class="h-8 w-8 rounded-full object-cover" />
                    </div>
                    <div class="ml-2 text-gray-900 dark:text-white">{{ post.author }}</div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div class="flex flex-col space-y-2">
                    <span :class="[getStatusClass(post.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                      {{ post.status }}
                    </span>
                    <span
                      v-if="isPartOfThread(post)"
                      class="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400 w-fit"
                    >
                      Thread {{ post.isThreadStarter ? '(Starter)' : '' }}
                    </span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {{ formatDate(post.scheduledDate || post.publishedDate) }}
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-3">
                    <button
                      @click="openEditPostModal(post)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150"
                      title="Edit post"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit</span>
                    </button>
                    <button
                      @click="deletePost(post.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-all duration-150"
                      title="Delete post"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white',
                currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700'
              ]"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white',
                currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700'
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredPosts.length) }}</span> of
                <span class="font-medium">{{ filteredPosts.length }}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="previousPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700 dark:text-gray-500"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>
                <button
                  v-for="page in totalPages"
                  :key="page"
                  @click="changePage(page)"
                  :class="[
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 dark:ring-gray-600',
                    page === currentPage
                      ? 'bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                      : 'text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-blue-gray-700'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700 dark:text-gray-500"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
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

    <!-- Post Edit/Create Modal -->
    <div v-if="showPostModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closePostModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {{ isNewPost ? 'Create New Post' : 'Edit Post' }}
              </h3>
              <div class="mt-4">
                <form @submit.prevent="savePost" class="space-y-4">
                  <!-- Platform selection -->
                  <div>
                    <label for="post-platform" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Platform</label>
                    <select
                      id="post-platform"
                      v-if="currentPost"
                      v-model="currentPost.platform"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option v-for="platform in platforms.slice(1)" :key="platform" :value="platform">
                        {{ platform }}
                      </option>
                    </select>
                  </div>

                  <!-- Post content -->
                  <div>
                    <label for="post-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                    <textarea
                      id="post-content"
                      v-if="currentPost"
                      v-model="currentPost.content"
                      @input="updateTags"
                      rows="4"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="What's on your mind? Use #hashtags for better discoverability."
                      required
                    ></textarea>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {{ currentPost?.content?.length || 0 }}/300 characters
                    </p>
                  </div>

                  <!-- Images -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Images</label>
                    <div v-if="currentPost && currentPost.images.length > 0" class="mt-2 grid grid-cols-2 gap-2">
                      <div
                        v-for="(image, index) in currentPost.images"
                        :key="index"
                        class="relative aspect-square overflow-hidden rounded-lg"
                      >
                        <img
                          :src="image"
                          :alt="`Image ${index + 1}`"
                          class="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          @click="removeImageFromPost(index)"
                          class="absolute right-1 top-1 rounded-full bg-gray-800 bg-opacity-75 p-1 text-white hover:bg-opacity-100"
                        >
                          <div class="i-hugeicons-cancel-circle h-4 w-4"></div>
                        </button>
                      </div>
                    </div>
                    <div class="mt-2" v-if="currentPost && currentPost.images.length < 4">
                      <button
                        type="button"
                        class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                      >
                        <div class="i-hugeicons-image-01 h-4 w-4 mr-1"></div>
                        Add Image
                      </button>
                    </div>
                  </div>

                  <!-- Tags -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
                    <div v-if="currentPost && currentPost.tags.length > 0" class="mt-2 flex flex-wrap gap-2">
                      <span
                        v-for="tag in currentPost.tags"
                        :key="tag"
                        class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        #{{ tag }}
                      </span>
                    </div>
                    <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Add #hashtags in your content to automatically generate tags
                    </p>
                  </div>

                  <!-- Schedule date and time -->
                  <div>
                    <label for="post-schedule" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Schedule Date & Time</label>
                    <input
                      type="datetime-local"
                      id="post-schedule"
                      v-if="currentPost"
                      v-model="currentPost.scheduledDate"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- Status -->
                  <div>
                    <label for="post-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      id="post-status"
                      v-if="currentPost"
                      v-model="currentPost.status"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Scheduled">Scheduled</option>
                    </select>
                  </div>

                  <!-- Thread options (if creating a new post) -->
                  <div v-if="isNewPost">
                    <div class="flex items-center">
                      <input
                        id="create-thread"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                      <label for="create-thread" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Create as thread starter (for multi-post threads)
                      </label>
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      {{ isNewPost ? 'Create Post' : 'Save Changes' }}
                    </button>
                    <button
                      type="button"
                      @click="closePostModal"
                      class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
