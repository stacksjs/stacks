<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import type { StorePost } from '../../../../types/defaults'
import { usePosts } from '../../../../functions/cms/posts'
import { useCategorizables } from '../../../../functions/cms/categorizables'

const postsModule = usePosts()
const categorizablesModule = useCategorizables()

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Blog Posts',
})

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

// Doughnut chart options (no scales)
const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
    },
  },
}

// Generate monthly data for charts
const monthlyChartData = computed(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Sample data - in a real app, this would be calculated from actual post data
  const viewsData = [2500, 3200, 2800, 3600, 4100, 3800, 4500, 5200, 5800, 5400, 6200, 6800]
  const postsData = [4, 6, 5, 7, 8, 6, 9, 10, 12, 9, 11, 14]
  const commentsData = [35, 42, 38, 45, 52, 48, 56, 62, 68, 58, 72, 78]

  // Views chart data
  const viewsChartData = {
    labels: months,
    datasets: [
      {
        label: 'Post Views',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: viewsData,
      },
    ],
  }

  // Posts and comments chart data
  const postsCommentsChartData = {
    labels: months,
    datasets: [
      {
        label: 'Posts Published',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: postsData,
      },
      {
        label: 'Comments',
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: commentsData,
      },
    ],
  }

  // Category distribution chart data
  const categoryCounts: Record<string, number> = {}

  posts.value.forEach(post => {
    if (post.category) {
      categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1
    }
  })

  const categoryLabels = Object.keys(categoryCounts)
  const categoryData = Object.values(categoryCounts)
  const backgroundColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ]

  const categoryChartData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryData,
        backgroundColor: backgroundColors.slice(0, categoryLabels.length),
        borderWidth: 0,
      },
    ],
  }

  return {
    viewsChartData,
    postsCommentsChartData,
    categoryChartData,
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Sample posts data
const posts: Ref<Posts[]> = ref([
  {
    id: 1,
    title: '10 Tips for Better Code Quality',
    excerpt: 'Improve your code quality with these essential tips that every developer should know.',
    slug: '10-tips-for-better-code-quality',
    category: 'Tutorials',
    tags: ['Coding', 'Best Practices', 'Development'],
    author: 'Jane Doe',
    views: 12450,
    comments: 78,
    published: '2023-12-01',
    status: 'Published',
    featured: true,
    poster: 'https://picsum.photos/seed/1/280/160'
  },
  {
    id: 2,
    title: 'The Future of JavaScript Frameworks',
    excerpt: 'Exploring what\'s next for JavaScript frameworks and the evolving web development landscape.',
    slug: 'future-of-javascript-frameworks',
    category: 'Technology',
    tags: ['JavaScript', 'Frameworks', 'Web Development'],
    author: 'John Smith',
    views: 9870,
    comments: 124,
    published: '2023-11-28',
    status: 'Published',
    featured: true,
    poster: 'https://picsum.photos/seed/2/280/160'
  },
  {
    id: 3,
    title: 'Getting Started with Vue 3',
    excerpt: 'A comprehensive guide to getting started with Vue 3 and its composition API.',
    slug: 'getting-started-with-vue-3',
    category: 'Tutorials',
    tags: ['Vue', 'JavaScript', 'Frontend'],
    author: 'Jane Doe',
    views: 8760,
    comments: 45,
    published: '2023-11-25',
    status: 'Published',
    featured: false,
    poster: 'https://picsum.photos/seed/3/280/160'
  },
  {
    id: 4,
    title: 'Review: Latest MacBook Pro',
    excerpt: 'An in-depth review of the latest MacBook Pro and how it performs for developers.',
    slug: 'review-latest-macbook-pro',
    category: 'Reviews',
    tags: ['Hardware', 'Apple', 'Development Tools'],
    author: 'Michael Brown',
    views: 7650,
    comments: 92,
    published: '2023-11-20',
    status: 'Published',
    featured: false,
    poster: 'https://picsum.photos/seed/4/280/160'
  },
  {
    id: 5,
    title: 'Understanding Web Accessibility',
    excerpt: 'Why web accessibility matters and how to implement it in your projects.',
    slug: 'understanding-web-accessibility',
    category: 'Tutorials',
    tags: ['Accessibility', 'Web Development', 'UX'],
    author: 'Emily Davis',
    views: 6540,
    comments: 31,
    published: '2023-11-15',
    status: 'Published',
    featured: false,
    poster: 'https://picsum.photos/seed/5/280/160'
  },
  {
    id: 6,
    title: 'Introduction to TypeScript',
    excerpt: 'Learn the basics of TypeScript and how it can improve your JavaScript projects.',
    slug: 'introduction-to-typescript',
    category: 'Tutorials',
    tags: ['TypeScript', 'JavaScript', 'Development'],
    author: 'Jane Doe',
    views: 0,
    comments: 0,
    published: '',
    status: 'Draft',
    featured: false,
    poster: 'https://picsum.photos/seed/6/280/160'
  },
  {
    id: 7,
    title: 'Building a REST API with Node.js',
    excerpt: 'A step-by-step guide to building a robust REST API using Node.js and Express.',
    slug: 'building-rest-api-nodejs',
    category: 'Tutorials',
    tags: ['Node.js', 'API', 'Backend'],
    author: 'John Smith',
    views: 0,
    comments: 0,
    published: '',
    status: 'Draft',
    featured: false,
    poster: 'https://picsum.photos/seed/7/280/160'
  },
  {
    id: 8,
    title: 'CSS Grid vs Flexbox',
    excerpt: 'Comparing CSS Grid and Flexbox: when to use each layout system.',
    slug: 'css-grid-vs-flexbox',
    category: 'Tutorials',
    tags: ['CSS', 'Web Design', 'Frontend'],
    author: 'Jane Doe',
    views: 0,
    comments: 0,
    published: '',
    status: 'Draft',
    featured: false,
    poster: 'https://picsum.photos/seed/8/280/160'
  },
  {
    id: 9,
    title: 'The Impact of AI on Software Development',
    excerpt: 'How artificial intelligence is changing the landscape of software development.',
    slug: 'ai-impact-software-development',
    category: 'Technology',
    tags: ['AI', 'Software Development', 'Future Tech'],
    author: 'Michael Brown',
    views: 5430,
    comments: 67,
    published: '2023-11-10',
    status: 'Published',
    featured: false,
    poster: 'https://picsum.photos/seed/9/280/160'
  },
  {
    id: 10,
    title: 'Optimizing Website Performance',
    excerpt: 'Techniques and best practices for optimizing your website\'s performance.',
    slug: 'optimizing-website-performance',
    category: 'Tutorials',
    tags: ['Performance', 'Web Development', 'Optimization'],
    author: 'Emily Davis',
    views: 4980,
    comments: 23,
    published: '2023-11-05',
    status: 'Published',
    featured: false,
    poster: 'https://picsum.photos/seed/10/280/160'
  }
])

// Categories for filtering
const categories = ref<Categorizable[]>([])

// Statuses for filtering
const statuses = [
  { id: 1, name: 'All Statuses' },
  { id: 2, name: 'Published' },
  { id: 3, name: 'Draft' },
  { id: 4, name: 'Scheduled' },
  { id: 5, name: 'Archived' }
]

// Filter and sort options
const searchQuery = ref('')
const selectedCategory = ref('All Categories')
const selectedStatus = ref('All Statuses')
const selectedTag = ref('All Tags')
const sortBy = ref('published')
const sortOrder = ref('desc')

// New Post Modal
const showNewPostModal = ref(false)
const newPost = ref({
  title: '',
  excerpt: '',
  category: 'Tutorials',
  tags: '',
  content: '',
  status: 'Draft',
  poster: 'https://picsum.photos/seed/new/280/160'
})

// Get all unique tags from posts
const allTags = computed(() => {
  const tagsSet = new Set<string>()
  tagsSet.add('All Tags')

  posts.value.forEach(post => {
    post.tags.forEach(tag => {
      tagsSet.add(tag)
    })
  })

  return Array.from(tagsSet)
})

onMounted(async () => {
  await fetchCategories()
})

function openNewPostModal() {
  showNewPostModal.value = true
}

async function fetchCategories() {
  const allCategories = await categorizablesModule.fetchCategorizables()
  categories.value = allCategories
}

function closeNewPostModal() {
  showNewPostModal.value = false
  // Reset form
  newPost.value = {
    title: '',
    excerpt: '',
    category: 'Tutorials',
    tags: '',
    content: '',
    status: 'Draft',
    poster: 'https://picsum.photos/seed/new/280/160'
  }
}

async function createNewPost() {
  // In a real app, this would send data to the server
  const tagsArray = newPost.value.tags.split(',').map(tag => tag.trim()).filter(tag => tag)

  const post = {
    id: posts.value.length + 1,
    title: newPost.value.title,
    excerpt: newPost.value.excerpt,
    slug: newPost.value.title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-'),
    category: newPost.value.category,
    tags: tagsArray,
    content: newPost.value.content,
    author: 'Current User', // In a real app, this would be the current user
    published: newPost.value.status === 'Published' ? new Date().toISOString().split('T')[0] : '',
    status: newPost.value.status,
    featured: false,
    poster: newPost.value.poster
  } as StorePost

  await postsModule.createPost(post)
  
  // posts.value.unshift(post)
  closeNewPostModal()
}

// Computed filtered and sorted posts
const filteredPosts = computed(() => {
  return posts.value
    .filter(post => {
      // Apply search filter
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply category filter
      const matchesCategory = selectedCategory.value === 'All Categories' || post.category === selectedCategory.value

      // Apply status filter
      const matchesStatus = selectedStatus.value === 'All Statuses' || post.status === selectedStatus.value

      // Apply tag filter
      const matchesTag = selectedTag.value === 'All Tags' || post.tags.includes(selectedTag.value)

      return matchesSearch && matchesCategory && matchesStatus && matchesTag
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'title') {
        comparison = a.title.localeCompare(b.title)
      } else if (sortBy.value === 'author') {
        comparison = a.author.localeCompare(b.author)
      } else if (sortBy.value === 'views') {
        comparison = a.views - b.views
      } else if (sortBy.value === 'comments') {
        comparison = a.comments - b.comments
      } else if (sortBy.value === 'published') {
        // Handle draft posts (empty published date)
        if (!a.published && !b.published) return 0
        if (!a.published) return 1
        if (!b.published) return -1
        return new Date(a.published).getTime() - new Date(b.published).getTime()
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
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'Draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Archived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format date
function formatDate(dateString: string): string {
  if (!dateString) return 'Not published'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Bulk actions
const selectedPostIds = ref<number[]>([])
const selectAll = ref(false)

function toggleSelectAll(): void {
  if (selectAll.value) {
    selectedPostIds.value = paginatedPosts.value.map(post => post.id)
  } else {
    selectedPostIds.value = []
  }
}

function togglePostSelection(postId: number): void {
  const index = selectedPostIds.value.indexOf(postId)
  if (index === -1) {
    selectedPostIds.value.push(postId)
  } else {
    selectedPostIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all posts are selected
  selectAll.value = paginatedPosts.value.every(post => selectedPostIds.value.includes(post.id))
}

// Filter by tag
function filterByTag(tag: string): void {
  selectedTag.value = tag
  // Reset to first page when changing filters
  currentPage.value = 1
}

const hasSelectedPosts = computed(() => selectedPostIds.value.length > 0)

// Preview tags for new post
const previewTags = computed(() => {
  if (!newPost.value.tags) return []
  return newPost.value.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
})

// Computed blog post statistics
const blogStats = computed(() => {
  // Count posts by status
  const publishedPosts = posts.value.filter(post => post.status === 'Published').length
  const draftPosts = posts.value.filter(post => post.status === 'Draft').length
  const scheduledPosts = posts.value.filter(post => post.status === 'Scheduled').length
  const archivedPosts = posts.value.filter(post => post.status === 'Archived').length

  // Calculate total views and comments
  const totalViews = posts.value.reduce((sum, post) => sum + post.views, 0)
  const totalComments = posts.value.reduce((sum, post) => sum + post.comments, 0)

  // Calculate average views and comments per post
  const publishedPostsCount = Math.max(1, publishedPosts) // Avoid division by zero
  const avgViewsPerPost = Math.round(totalViews / publishedPostsCount)
  const avgCommentsPerPost = (totalComments / publishedPostsCount).toFixed(1)

  // Find most popular post
  let mostPopularPost = posts.value[0] || { title: 'None', views: 0 }

  for (const post of posts.value) {
    if (post.views > mostPopularPost.views) {
      mostPopularPost = post
    }
  }

  // Find most commented post
  let mostCommentedPost = posts.value[0] || { title: 'None', comments: 0 }

  for (const post of posts.value) {
    if (post.comments > mostCommentedPost.comments) {
      mostCommentedPost = post
    }
  }

  // Count posts by author
  const authorCounts: Record<string, number> = {}

  posts.value.forEach(post => {
    if (post.author) {
      authorCounts[post.author] = (authorCounts[post.author] || 0) + 1
    }
  })

  // Find top author
  let topAuthor = { name: 'None', count: 0 }

  for (const [author, count] of Object.entries(authorCounts)) {
    if (count > topAuthor.count) {
      topAuthor = { name: author, count }
    }
  }

  return {
    totalPosts: posts.value.length,
    publishedPosts,
    draftPosts,
    scheduledPosts,
    archivedPosts,
    totalViews,
    totalComments,
    avgViewsPerPost,
    avgCommentsPerPost,
    mostPopularPost,
    mostCommentedPost,
    topAuthor
  }
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Posts</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage all your blog posts
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openNewPostModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              New Post
            </button>
          </div>
        </div>

        <!-- Time range selector -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Overview of your blog performance
          </p>
          <div class="relative">
            <select v-model="timeRange" class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
              <option v-for="range in timeRanges" :key="range" :value="range">{{ range }}</option>
            </select>
          </div>
        </div>

        <!-- Stats -->
        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Posts</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ blogStats.totalPosts }}</dd>
            <dd class="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ blogStats.publishedPosts }} published, {{ blogStats.draftPosts }} drafts</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Views</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ blogStats.totalViews.toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ blogStats.avgViewsPerPost.toLocaleString() }} avg per post</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Comments</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ blogStats.totalComments }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ blogStats.avgCommentsPerPost }} avg per post</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Top Author</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ blogStats.topAuthor.name }}</dd>
            <dd class="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ blogStats.topAuthor.count }} posts</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800 lg:col-span-2">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Post Views</h3>
              <div class="mt-2 h-80">
                <Line :data="monthlyChartData.viewsChartData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Category Distribution</h3>
              <div class="mt-2 h-80">
                <Doughnut :data="monthlyChartData.categoryChartData" :options="doughnutChartOptions" />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-1">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Posts & Comments</h3>
              <div class="mt-2 h-80">
                <Bar :data="monthlyChartData.postsCommentsChartData" :options="chartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <select
              v-model="selectedCategory"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 sm:min-w-[180px]"
            >
              <option v-for="category in categories" :key="category.id" :value="category.name">{{ category.name }}</option>
            </select>

            <select
              v-model="selectedStatus"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="status in statuses" :key="status.id" :value="status.name">{{ status.name }}</option>
            </select>

            <select
              v-model="selectedTag"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
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
        <div v-if="hasSelectedPosts" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-info-circle h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-700 dark:text-blue-300">{{ selectedPostIds.length }} posts selected</span>
            </div>
            <div class="flex space-x-2">
              <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                <div class="i-hugeicons-archive-box h-4 w-4 mr-1"></div>
                Archive
              </button>
              <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                <div class="i-hugeicons-duplicate h-4 w-4 mr-1"></div>
                Duplicate
              </button>
              <button type="button" class="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Active tag filter -->
        <div v-if="selectedTag !== 'All Tags'" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-tag-01 h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-700 dark:text-blue-300">
                Filtering by tag: <span class="font-medium">{{ selectedTag }}</span>
              </span>
            </div>
            <button
              @click="selectedTag = 'All Tags'"
              class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-cancel-01 h-4 w-4 mr-1"></div>
              Clear Filter
            </button>
          </div>
        </div>

        <!-- Posts table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Posts</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all blog posts including title, author, views, and status.
            </p>
          </div>
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <div class="flex items-center">
                          <input
                            id="select-all"
                            type="checkbox"
                            v-model="selectAll"
                            @change="toggleSelectAll"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                          />
                        </div>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <!-- OG Image column (no header text) -->
                      </th>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('title')" class="group inline-flex items-center">
                          Title
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'title'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('author')" class="group inline-flex items-center">
                          Author
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'author'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Category</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('views')" class="group inline-flex items-center">
                          Views
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'views'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('comments')" class="group inline-flex items-center">
                          Comments
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'comments'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('published')" class="group inline-flex items-center">
                          Published
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'published'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                    <tr v-for="post in paginatedPosts" :key="post.id" :class="{ 'bg-blue-50 dark:bg-blue-900/10': selectedPostIds.includes(post.id) }">
                      <td class="relative py-4 pl-3 pr-4 text-sm font-medium sm:pr-6">
                        <div class="flex items-center">
                          <input
                            :id="`post-${post.id}`"
                            type="checkbox"
                            :checked="selectedPostIds.includes(post.id)"
                            @change="togglePostSelection(post.id)"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                          />
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div class="h-16 w-28 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <img
                            :src="post.poster"
                            :alt="`OG image for ${post.title}`"
                            class="h-full w-full object-cover"
                          />
                        </div>
                      </td>
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        <div class="flex items-center">
                          <div>
                            <div class="font-medium">{{ post.title }}</div>
                            <div class="mt-1 text-gray-500 dark:text-gray-400 text-xs truncate max-w-md">{{ post.excerpt }}</div>
                            <div class="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <span class="truncate">{{ post.slug }}</span>
                            </div>
                            <div class="mt-2 flex flex-wrap gap-1">
                              <button
                                v-for="tag in post.tags"
                                :key="tag"
                                @click="filterByTag(tag)"
                                class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30 dark:hover:bg-blue-900/50"
                                :class="{ 'bg-blue-100 dark:bg-blue-900/50': selectedTag === tag }"
                              >
                                <div class="i-hugeicons-tag-01 h-3 w-3 mr-1"></div>
                                {{ tag }}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ post.author }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ post.category }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ post.views.toLocaleString() }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ post.comments }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ formatDate(post.published) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(post.status)">
                          {{ post.status }}
                        </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="paginatedPosts.length === 0">
                      <td colspan="10" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No posts found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="mt-6 flex items-center justify-between">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredPosts.length) }}</span> of
            <span class="font-medium">{{ filteredPosts.length }}</span> results
          </div>
          <div class="flex space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === 1
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
            </button>
            <button
              v-for="page in totalPages"
              :key="page"
              @click="changePage(page)"
              :class="[
                'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset',
                page === currentPage
                  ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 focus:z-20 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              {{ page }}
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === totalPages
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Post Modal -->
    <div v-if="showNewPostModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeNewPostModal"></div>

        <!-- Modal panel -->
        <div class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:align-middle dark:bg-blue-gray-800">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 dark:bg-blue-gray-800">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">Create New Post</h3>
                <div class="mt-6 space-y-6">
                  <div>
                    <label for="post-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="post-title"
                        v-model="newPost.title"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="post-excerpt" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Excerpt</label>
                    <div class="mt-1">
                      <textarea
                        id="post-excerpt"
                        v-model="newPost.excerpt"
                        rows="3"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      ></textarea>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label for="post-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                      <div class="mt-1">
                        <select
                          id="post-category"
                          v-model="newPost.category"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option v-for="category in categories.filter(c => c.name !== 'All Categories')" :key="category.id" :value="category.name">{{ category.name }}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label for="post-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <div class="mt-1">
                        <select
                          id="post-status"
                          v-model="newPost.status"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option v-for="status in statuses.filter(s => s.name !== 'All Statuses')" :key="status.id" :value="status.name">{{ status.name }}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="post-tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma separated)</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="post-tags"
                        v-model="newPost.tags"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="e.g. JavaScript, Web Development, Tutorial"
                      />
                    </div>
                    <div v-if="previewTags.length > 0" class="mt-2 flex flex-wrap gap-1">
                      <div
                        v-for="tag in previewTags"
                        :key="tag"
                        class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30"
                      >
                        <div class="i-hugeicons-tag-01 h-3 w-3 mr-1"></div>
                        {{ tag }}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="post-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                    <div class="mt-1">
                      <textarea
                        id="post-content"
                        v-model="newPost.content"
                        rows="6"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      ></textarea>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">OG Image</label>
                    <div class="mt-1 flex items-center space-x-4">
                      <div class="h-24 w-40 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <img :src="newPost.poster" alt="OG Image Preview" class="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-blue-gray-600"
                      >
                        <div class="i-hugeicons-image-01 h-5 w-5 mr-1"></div>
                        Change Image
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-blue-gray-900">
            <button
              type="button"
              @click="createNewPost"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Create Post
            </button>
            <button
              type="button"
              @click="closeNewPostModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
