<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Blog SEO',
})

// Define types
interface SeoSettings {
  id: number
  title: string
  metaDescription: string
  focusKeyword: string
  slug: string // Keep as required for the interface
  ogTitle: string
  ogDescription: string
  ogImage: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  canonicalUrl: string
  robots: string
  schema: string
  score: number
  lastUpdated: string
}

interface Post {
  id: number
  title: string
  slug: string
  category: string
  published: string
  status: string
}

// Sample posts data
const posts = ref<Post[]>([
  {
    id: 1,
    title: '10 Tips for Better Code Quality',
    slug: '10-tips-for-better-code-quality',
    category: 'Tutorials',
    published: '2023-12-01',
    status: 'Published'
  },
  {
    id: 2,
    title: 'The Future of JavaScript Frameworks',
    slug: 'future-of-javascript-frameworks',
    category: 'Technology',
    published: '2023-11-28',
    status: 'Published'
  },
  {
    id: 3,
    title: 'Getting Started with Vue 3',
    slug: 'getting-started-with-vue-3',
    category: 'Tutorials',
    published: '2023-11-25',
    status: 'Published'
  },
  {
    id: 4,
    title: 'Review: Latest MacBook Pro',
    slug: 'review-latest-macbook-pro',
    category: 'Reviews',
    published: '2023-11-20',
    status: 'Published'
  },
  {
    id: 5,
    title: 'Understanding Web Accessibility',
    slug: 'understanding-web-accessibility',
    category: 'Tutorials',
    published: '2023-11-15',
    status: 'Published'
  }
])

// Sample SEO data for posts
const seoData = ref<SeoSettings[]>([
  {
    id: 1,
    title: '10 Tips for Better Code Quality - Ultimate Guide',
    metaDescription: 'Improve your code quality with these essential tips that every developer should know. Learn best practices for cleaner, more maintainable code.',
    focusKeyword: 'code quality',
    slug: '10-tips-for-better-code-quality',
    ogTitle: '10 Tips for Better Code Quality | Developer Guide',
    ogDescription: 'Discover 10 essential tips to improve your code quality and become a better developer. Practical advice for cleaner, more maintainable code.',
    ogImage: 'https://picsum.photos/seed/1/1200/630',
    twitterTitle: '10 Tips for Better Code Quality',
    twitterDescription: 'Improve your code quality with these 10 essential tips every developer should know.',
    twitterImage: 'https://picsum.photos/seed/1/1200/630',
    canonicalUrl: 'https://example.com/blog/10-tips-for-better-code-quality',
    robots: 'index, follow',
    schema: 'Article',
    score: 85,
    lastUpdated: '2023-12-05'
  },
  {
    id: 2,
    title: 'The Future of JavaScript Frameworks in 2024 and Beyond',
    metaDescription: 'Exploring what\'s next for JavaScript frameworks and the evolving web development landscape. Trends, predictions, and insights.',
    focusKeyword: 'javascript frameworks future',
    slug: 'future-of-javascript-frameworks',
    ogTitle: 'The Future of JavaScript Frameworks | 2024 Trends',
    ogDescription: 'What\'s next for JavaScript frameworks? Explore the future of web development and upcoming trends for 2024 and beyond.',
    ogImage: 'https://picsum.photos/seed/2/1200/630',
    twitterTitle: 'The Future of JavaScript Frameworks',
    twitterDescription: 'What\'s next for JS frameworks? Our predictions for 2024 and beyond.',
    twitterImage: 'https://picsum.photos/seed/2/1200/630',
    canonicalUrl: 'https://example.com/blog/future-of-javascript-frameworks',
    robots: 'index, follow',
    schema: 'Article',
    score: 92,
    lastUpdated: '2023-11-30'
  },
  {
    id: 3,
    title: 'Getting Started with Vue 3: A Beginner\'s Guide',
    metaDescription: 'A comprehensive guide to getting started with Vue 3 and its composition API. Learn how to build modern web applications.',
    focusKeyword: 'vue 3 beginners guide',
    slug: 'getting-started-with-vue-3',
    ogTitle: 'Getting Started with Vue 3 | Beginner\'s Guide',
    ogDescription: 'Learn Vue 3 from scratch with our comprehensive beginner\'s guide. Master the composition API and build modern web apps.',
    ogImage: 'https://picsum.photos/seed/3/1200/630',
    twitterTitle: 'Vue 3 Beginner\'s Guide',
    twitterDescription: 'Start your Vue 3 journey with our comprehensive guide for beginners.',
    twitterImage: 'https://picsum.photos/seed/3/1200/630',
    canonicalUrl: 'https://example.com/blog/getting-started-with-vue-3',
    robots: 'index, follow',
    schema: 'HowTo',
    score: 78,
    lastUpdated: '2023-11-27'
  },
  {
    id: 4,
    title: 'Review: Latest MacBook Pro for Developers in 2023',
    metaDescription: 'An in-depth review of the latest MacBook Pro and how it performs for developers. Benchmarks, real-world tests, and comparisons.',
    focusKeyword: 'macbook pro developers review',
    slug: 'review-latest-macbook-pro',
    ogTitle: 'MacBook Pro Review for Developers | Worth It in 2023?',
    ogDescription: 'Is the latest MacBook Pro worth it for developers? Read our in-depth review with benchmarks and real-world performance tests.',
    ogImage: 'https://picsum.photos/seed/4/1200/630',
    twitterTitle: 'MacBook Pro Developer Review',
    twitterDescription: 'Is the new MacBook Pro the ultimate developer machine? Our verdict inside.',
    twitterImage: 'https://picsum.photos/seed/4/1200/630',
    canonicalUrl: 'https://example.com/blog/review-latest-macbook-pro',
    robots: 'index, follow',
    schema: 'Review',
    score: 88,
    lastUpdated: '2023-11-22'
  },
  {
    id: 5,
    title: 'Understanding Web Accessibility: WCAG Guidelines Explained',
    metaDescription: 'Why web accessibility matters and how to implement it in your projects. A comprehensive guide to WCAG guidelines and best practices.',
    focusKeyword: 'web accessibility wcag',
    slug: 'understanding-web-accessibility',
    ogTitle: 'Web Accessibility Guide | WCAG Explained',
    ogDescription: 'Learn why web accessibility matters and how to implement WCAG guidelines in your projects. Make your websites accessible to everyone.',
    ogImage: 'https://picsum.photos/seed/5/1200/630',
    twitterTitle: 'Web Accessibility & WCAG Guide',
    twitterDescription: 'Make your websites accessible to everyone with our comprehensive WCAG guide.',
    twitterImage: 'https://picsum.photos/seed/5/1200/630',
    canonicalUrl: 'https://example.com/blog/understanding-web-accessibility',
    robots: 'index, follow',
    schema: 'Article',
    score: 95,
    lastUpdated: '2023-11-18'
  }
])

// Global SEO settings
const globalSeoSettings = ref({
  siteName: 'My Tech Blog',
  separator: ' | ',
  titleFormat: '%post_title% %separator% %site_name%',
  metaDescription: 'A blog about web development, programming, and technology.',
  ogImage: 'https://picsum.photos/seed/global/1200/630',
  twitterUsername: '@mytechblog',
  twitterCardType: 'summary_large_image',
  facebookAppId: '123456789012345',
  defaultSchema: 'Article',
  googleVerification: 'abcdefghijklmnopqrstuvwxyz',
  bingVerification: '1234567890ABCDEFGHIJKL',
  robotsTxt: 'User-agent: *\nDisallow: /admin/\nDisallow: /dashboard/\nSitemap: https://example.com/sitemap.xml',
  sitemapEnabled: true,
  sitemapFrequency: 'weekly'
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('score')
const sortOrder = ref('desc')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// Edit SEO Modal
const showEditModal = ref(false)
const currentSeo = ref<SeoSettings | null>(null)

// Global Settings Modal
const showGlobalSettingsModal = ref(false)

// Bulk Optimization Modal
const showBulkOptimizationModal = ref(false)
const selectedPostIds = ref<number[]>([])
const selectAll = ref(false)

// SEO Analysis Modal
const showAnalysisModal = ref(false)
const analysisPostId = ref<number | null>(null)

// Computed properties
const filteredSeoData = computed(() => {
  let result = [...seoData.value]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.metaDescription.toLowerCase().includes(query) ||
      item.focusKeyword.toLowerCase().includes(query) ||
      item.slug.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result.sort((a, b) => {
    const sortField = sortBy.value as keyof SeoSettings
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
const totalPages = computed(() => Math.ceil(filteredSeoData.value.length / itemsPerPage.value))

const paginatedSeoData = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredSeoData.value.slice(startIndex, endIndex)
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
function openEditModal(seo: SeoSettings): void {
  currentSeo.value = { ...seo }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  currentSeo.value = null
}

function saveSeoSettings(): void {
  if (!currentSeo.value) return

  const index = seoData.value.findIndex(item => item.id === currentSeo.value!.id)
  if (index !== -1) {
    // Make a copy of the current SEO settings
    const updatedSeo = { ...currentSeo.value };

    // Ensure slug is a string
    if (updatedSeo.slug === undefined) {
      updatedSeo.slug = '';
    }

    // Update the last updated date
    updatedSeo.lastUpdated = new Date().toISOString().split('T')[0];

    // Update the SEO data
    seoData.value[index] = updatedSeo;
  }

  closeEditModal()
}

function openGlobalSettingsModal(): void {
  showGlobalSettingsModal.value = true
}

function closeGlobalSettingsModal(): void {
  showGlobalSettingsModal.value = false
}

function saveGlobalSettings(): void {
  // In a real app, this would save to the server
  closeGlobalSettingsModal()
}

function openBulkOptimizationModal(): void {
  showBulkOptimizationModal.value = true
}

function closeBulkOptimizationModal(): void {
  showBulkOptimizationModal.value = false
  selectedPostIds.value = []
  selectAll.value = false
}

function runBulkOptimization(): void {
  // In a real app, this would trigger optimization for selected posts
  closeBulkOptimizationModal()
}

function openAnalysisModal(postId: number): void {
  analysisPostId.value = postId
  showAnalysisModal.value = true
}

function closeAnalysisModal(): void {
  showAnalysisModal.value = false
  analysisPostId.value = null
}

function toggleSelectAll(): void {
  if (selectAll.value) {
    // Select all posts
    selectedPostIds.value = paginatedSeoData.value.map(item => item.id)
  } else {
    // Deselect all
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
  selectAll.value = paginatedSeoData.value.every(item => selectedPostIds.value.includes(item.id))
}

// Get score color class
function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// Get score background class
function getScoreBgClass(score: number): string {
  if (score >= 90) return 'bg-green-100 dark:bg-green-900/30'
  if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30'
  return 'bg-red-100 dark:bg-red-900/30'
}

const hasSelectedPosts = computed(() => selectedPostIds.value.length > 0)

// Generate preview for title and description
function generateSeoPreview(seo: SeoSettings): string {
  return seo.title + ' - ' + seo.metaDescription.substring(0, 160) + (seo.metaDescription.length > 160 ? '...' : '')
}

// Get post title by ID
function getPostTitleById(id: number): string {
  const post = posts.value.find(p => p.id === id)
  return post ? post.title : 'Unknown Post'
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">SEO</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Optimize your blog posts for search engines
            </p>
          </div>
          <div class="mt-4 flex space-x-3 sm:mt-0">
            <button
              type="button"
              @click="openGlobalSettingsModal"
              class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-settings-02 h-5 w-5 mr-1"></div>
              Global Settings
            </button>
            <button
              type="button"
              @click="openBulkOptimizationModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-magic-wand-05 h-5 w-5 mr-1"></div>
              Bulk Optimize
            </button>
          </div>
        </div>

        <!-- SEO Overview Cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Average SEO Score -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="i-hugeicons-presentation-bar-chart-02 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Average SEO Score</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ Math.round(seoData.reduce((acc, item) => acc + item.score, 0) / seoData.length) }}%
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3 dark:bg-blue-gray-700">
              <div class="text-sm">
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View details</a>
              </div>
            </div>
          </div>

          <!-- Posts with Good SEO -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-green-600 dark:text-green-400"></div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Posts with Good SEO</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ seoData.filter(item => item.score >= 80).length }} / {{ seoData.length }}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3 dark:bg-blue-gray-700">
              <div class="text-sm">
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View details</a>
              </div>
            </div>
          </div>

          <!-- Posts Needing Improvement -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="i-hugeicons-alert-02 h-6 w-6 text-yellow-600 dark:text-yellow-400"></div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Needs Improvement</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ seoData.filter(item => item.score < 80 && item.score >= 60).length }} / {{ seoData.length }}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3 dark:bg-blue-gray-700">
              <div class="text-sm">
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View details</a>
              </div>
            </div>
          </div>

          <!-- Posts with Poor SEO -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="i-hugeicons-cancel-circle h-6 w-6 text-red-600 dark:text-red-400"></div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Poor SEO</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ seoData.filter(item => item.score < 60).length }} / {{ seoData.length }}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3 dark:bg-blue-gray-700">
              <div class="text-sm">
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View details</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative w-full sm:max-w-md">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search by title, keyword, or slug..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="sortBy"
              class="block w-full min-w-[180px] rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="score">Sort by SEO Score</option>
              <option value="title">Sort by Title</option>
              <option value="lastUpdated">Sort by Last Updated</option>
            </select>

            <select
              v-model="sortOrder"
              class="block w-full min-w-[140px] rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>

            <select
              v-model="itemsPerPage"
              class="block w-full min-w-[140px] rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option :value="5">5 per page</option>
              <option :value="10">10 per page</option>
              <option :value="25">25 per page</option>
              <option :value="50">50 per page</option>
            </select>
          </div>
        </div>

        <!-- Bulk actions -->
        <div v-if="hasSelectedPosts" class="mt-4 bg-blue-50 p-4 rounded-lg shadow-sm dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-800 dark:text-blue-300">{{ selectedPostIds.length }} posts selected</span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="openBulkOptimizationModal"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-blue-600 shadow-sm ring-1 ring-inset ring-blue-300 hover:bg-blue-50 dark:bg-blue-gray-800 dark:text-blue-400 dark:ring-blue-500/30 dark:hover:bg-blue-500/10"
              >
                <div class="i-hugeicons-magic-wand-05 h-4 w-4 mr-1"></div>
                Optimize Selected
              </button>
            </div>
          </div>
        </div>

        <!-- SEO Table -->
        <div class="mt-6 flow-root">
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
                      Title
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Focus Keyword
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      SEO Score
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Last Updated
                    </th>
                    <th scope="col" class="relative px-4 py-3.5">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="item in paginatedSeoData" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                    <td class="relative px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          :checked="selectedPostIds.includes(item.id)"
                          @change="togglePostSelection(item.id)"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-4">
                      <div class="flex flex-col">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ item.title }}
                        </div>
                        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Slug: {{ item.slug }}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30">
                        <div class="i-hugeicons-tag-01 h-3 w-3 mr-1"></div>
                        {{ item.focusKeyword }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div :class="[
                          'text-sm font-medium',
                          getScoreColorClass(item.score)
                        ]">
                          {{ item.score }}%
                        </div>
                        <div class="ml-2 h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            :class="[
                              'h-2 rounded-full',
                              getScoreBgClass(item.score)
                            ]"
                            :style="{ width: `${item.score}%` }"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {{ item.lastUpdated }}
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button
                          @click="openAnalysisModal(item.id)"
                          class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <div class="i-hugeicons-analysis-text-link h-5 w-5"></div>
                          <span class="sr-only">Analyze</span>
                        </button>
                        <button
                          @click="openEditModal(item)"
                          class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          <span class="sr-only">Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedSeoData.length === 0">
                    <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No SEO data found. Try adjusting your search.
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
                Showing <span class="font-medium">{{ ((currentPage - 1) * itemsPerPage) + 1 }}</span> to <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredSeoData.length) }}</span> of <span class="font-medium">{{ filteredSeoData.length }}</span> results
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

  <!-- Edit SEO Modal -->
  <div v-if="showEditModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeEditModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-edit-01 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">Edit SEO Settings</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Optimize your post's SEO settings to improve search engine visibility.
                </p>
              </div>
            </div>
          </div>
          <div v-if="currentSeo" class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <!-- Tabs -->
              <div class="border-b border-gray-200 dark:border-gray-700">
                <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                  <a href="#" class="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-blue-400">
                    Basic SEO
                  </a>
                  <a href="#" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                    Social Media
                  </a>
                  <a href="#" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                    Advanced
                  </a>
                </nav>
              </div>

              <!-- Basic SEO Tab Content -->
              <div>
                <div class="space-y-4">
                  <div>
                    <label for="seo-title" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">SEO Title</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="seo-title"
                        v-model="currentSeo.title"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      />
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ currentSeo.title.length }}/60 characters
                      <span v-if="currentSeo.title.length > 60" class="text-red-500 dark:text-red-400">
                        (Too long)
                      </span>
                    </p>
                  </div>

                  <div>
                    <label for="seo-slug" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Slug</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="seo-slug"
                        v-model="currentSeo.slug"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="seo-focus-keyword" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Focus Keyword</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="seo-focus-keyword"
                        v-model="currentSeo.focusKeyword"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      />
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The main keyword you want this post to rank for
                    </p>
                  </div>

                  <div>
                    <label for="seo-meta-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Meta Description</label>
                    <div class="mt-2">
                      <textarea
                        id="seo-meta-description"
                        v-model="currentSeo.metaDescription"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      ></textarea>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ currentSeo.metaDescription.length }}/160 characters
                      <span v-if="currentSeo.metaDescription.length > 160" class="text-red-500 dark:text-red-400">
                        (Too long)
                      </span>
                    </p>
                  </div>

                  <div>
                    <label for="seo-canonical-url" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Canonical URL</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="seo-canonical-url"
                        v-model="currentSeo.canonicalUrl"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      />
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Leave empty to use the default URL
                    </p>
                  </div>

                  <div>
                    <label for="seo-robots" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Robots Meta</label>
                    <div class="mt-2">
                      <select
                        id="seo-robots"
                        v-model="currentSeo.robots"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="index, follow">index, follow</option>
                        <option value="noindex, follow">noindex, follow</option>
                        <option value="index, nofollow">index, nofollow</option>
                        <option value="noindex, nofollow">noindex, nofollow</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="seo-schema" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Schema Type</label>
                    <div class="mt-2">
                      <select
                        id="seo-schema"
                        v-model="currentSeo.schema"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Article">Article</option>
                        <option value="BlogPosting">Blog Post</option>
                        <option value="NewsArticle">News Article</option>
                        <option value="TechArticle">Tech Article</option>
                        <option value="Review">Review</option>
                        <option value="HowTo">How-To</option>
                        <option value="FAQ">FAQ</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SEO Preview -->
              <div class="mt-6 rounded-md border border-gray-200 p-4 dark:border-gray-700">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Google Search Preview</h4>
                <div class="mt-2 space-y-1">
                  <div class="text-blue-600 text-lg hover:underline dark:text-blue-400">{{ currentSeo.title }}</div>
                  <div class="text-green-600 text-sm dark:text-green-400">{{ currentSeo.canonicalUrl }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">{{ currentSeo.metaDescription.substring(0, 160) }}{{ currentSeo.metaDescription.length > 160 ? '...' : '' }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="saveSeoSettings"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Save Changes
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

  <!-- Global Settings Modal -->
  <div v-if="showGlobalSettingsModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeGlobalSettingsModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-cog-01 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">Global SEO Settings</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Configure global SEO settings for your entire blog.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <!-- Tabs -->
              <div class="border-b border-gray-200 dark:border-gray-700">
                <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                  <a href="#" class="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-blue-400">
                    General
                  </a>
                  <a href="#" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                    Social Media
                  </a>
                  <a href="#" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                    Webmaster Tools
                  </a>
                  <a href="#" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                    Sitemap
                  </a>
                </nav>
              </div>

              <!-- General Tab Content -->
              <div>
                <div class="space-y-4">
                  <div>
                    <label for="site-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Site Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="site-name"
                        v-model="globalSeoSettings.siteName"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="title-separator" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Title Separator</label>
                    <div class="mt-2">
                      <select
                        id="title-separator"
                        v-model="globalSeoSettings.separator"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value=" | ">|</option>
                        <option value=" - ">-</option>
                        <option value=" – ">–</option>
                        <option value=" — ">—</option>
                        <option value=" · ">·</option>
                        <option value=" • ">•</option>
                        <option value=" » ">»</option>
                        <option value=" : ">:</option>
                      </select>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Example: Post Title {{ globalSeoSettings.separator }} {{ globalSeoSettings.siteName }}
                    </p>
                  </div>

                  <div>
                    <label for="title-format" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Title Format</label>
                    <div class="mt-2">
                      <select
                        id="title-format"
                        v-model="globalSeoSettings.titleFormat"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="%post_title% %separator% %site_name%">Post Title - Site Name</option>
                        <option value="%site_name% %separator% %post_title%">Site Name - Post Title</option>
                        <option value="%post_title%">Post Title Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="meta-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Default Meta Description</label>
                    <div class="mt-2">
                      <textarea
                        id="meta-description"
                        v-model="globalSeoSettings.metaDescription"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                      ></textarea>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Used when individual posts don't have a meta description
                    </p>
                  </div>

                  <div>
                    <label for="default-schema" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Default Schema Type</label>
                    <div class="mt-2">
                      <select
                        id="default-schema"
                        v-model="globalSeoSettings.defaultSchema"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Article">Article</option>
                        <option value="BlogPosting">Blog Post</option>
                        <option value="NewsArticle">News Article</option>
                        <option value="TechArticle">Tech Article</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Robots.txt Editor -->
              <div class="mt-6 rounded-md border border-gray-200 p-4 dark:border-gray-700">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">robots.txt</h4>
                <div class="mt-2">
                  <textarea
                    v-model="globalSeoSettings.robotsTxt"
                    rows="6"
                    class="block w-full rounded-md border-0 py-1.5 font-mono text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="saveGlobalSettings"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Save Settings
            </button>
            <button
              type="button"
              @click="closeGlobalSettingsModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bulk Optimization Modal -->
  <div v-if="showBulkOptimizationModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeBulkOptimizationModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-magic-wand-05 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">Bulk SEO Optimization</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Automatically optimize SEO settings for the selected posts.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <div class="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <div class="i-hugeicons-info-circle h-5 w-5 text-blue-400"></div>
                  </div>
                  <div class="ml-3 flex-1 md:flex md:justify-between">
                    <p class="text-sm text-blue-700 dark:text-blue-300">
                      {{ selectedPostIds.length }} posts selected for optimization
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Optimization Options</h4>
                <div class="mt-4 space-y-4">
                  <div class="relative flex items-start">
                    <div class="flex h-6 items-center">
                      <input
                        id="optimize-titles"
                        type="checkbox"
                        checked
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                      />
                    </div>
                    <div class="ml-3 text-sm leading-6">
                      <label for="optimize-titles" class="font-medium text-gray-900 dark:text-white">Optimize Titles</label>
                      <p class="text-gray-500 dark:text-gray-400">Generate SEO-friendly titles based on content</p>
                    </div>
                  </div>

                  <div class="relative flex items-start">
                    <div class="flex h-6 items-center">
                      <input
                        id="optimize-descriptions"
                        type="checkbox"
                        checked
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                      />
                    </div>
                    <div class="ml-3 text-sm leading-6">
                      <label for="optimize-descriptions" class="font-medium text-gray-900 dark:text-white">Generate Meta Descriptions</label>
                      <p class="text-gray-500 dark:text-gray-400">Create compelling meta descriptions</p>
                    </div>
                  </div>

                  <div class="relative flex items-start">
                    <div class="flex h-6 items-center">
                      <input
                        id="extract-keywords"
                        type="checkbox"
                        checked
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                      />
                    </div>
                    <div class="ml-3 text-sm leading-6">
                      <label for="extract-keywords" class="font-medium text-gray-900 dark:text-white">Extract Focus Keywords</label>
                      <p class="text-gray-500 dark:text-gray-400">Identify the best focus keywords from content</p>
                    </div>
                  </div>

                  <div class="relative flex items-start">
                    <div class="flex h-6 items-center">
                      <input
                        id="optimize-social"
                        type="checkbox"
                        checked
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                      />
                    </div>
                    <div class="ml-3 text-sm leading-6">
                      <label for="optimize-social" class="font-medium text-gray-900 dark:text-white">Optimize Social Media</label>
                      <p class="text-gray-500 dark:text-gray-400">Generate social media titles and descriptions</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="runBulkOptimization"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Run Optimization
            </button>
            <button
              type="button"
              @click="closeBulkOptimizationModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SEO Analysis Modal -->
  <div v-if="showAnalysisModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeAnalysisModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-presentation-bar-chart-02 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">SEO Analysis</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Detailed SEO analysis for "{{ analysisPostId ? getPostTitleById(analysisPostId) : '' }}"
                </p>
              </div>
            </div>
          </div>
          <div v-if="analysisPostId" class="mt-5 sm:mt-4">
            <div class="space-y-6">
              <!-- Overall Score -->
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-lg font-medium text-gray-900 dark:text-white">Overall SEO Score</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Based on multiple factors</p>
                </div>
                <div class="flex items-center">
                  <div
                    class="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
                    :class="getScoreBgClass(seoData.find(item => item.id === analysisPostId)?.score || 0)"
                  >
                    <span :class="getScoreColorClass(seoData.find(item => item.id === analysisPostId)?.score || 0)">
                      {{ seoData.find(item => item.id === analysisPostId)?.score || 0 }}%
                    </span>
                  </div>
                </div>
              </div>

              <!-- Analysis Sections -->
              <div class="space-y-4">
                <!-- Content Analysis -->
                <div class="rounded-md border border-gray-200 overflow-hidden dark:border-gray-700">
                  <div class="bg-gray-50 px-4 py-3 dark:bg-blue-gray-700">
                    <h5 class="text-sm font-medium text-gray-900 dark:text-white">Content Analysis</h5>
                  </div>
                  <div class="px-4 py-3 divide-y divide-gray-200 dark:divide-gray-700">
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Focus keyword appears in the title</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your focus keyword is used in the SEO title</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Focus keyword appears in the meta description</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your focus keyword is used in the meta description</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-alert-02 h-5 w-5 text-yellow-500 dark:text-yellow-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Content length could be improved</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your content is 850 words. Consider expanding to at least 1000 words for better ranking.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Technical Analysis -->
                <div class="rounded-md border border-gray-200 overflow-hidden dark:border-gray-700">
                  <div class="bg-gray-50 px-4 py-3 dark:bg-blue-gray-700">
                    <h5 class="text-sm font-medium text-gray-900 dark:text-white">Technical Analysis</h5>
                  </div>
                  <div class="px-4 py-3 divide-y divide-gray-200 dark:divide-gray-700">
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">URL is SEO friendly</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your URL is concise and contains your focus keyword</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Schema markup is implemented</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your page includes proper schema markup</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-cancel-circle h-5 w-5 text-red-500 dark:text-red-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Missing image alt tags</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">3 images on your page are missing alt tags</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Readability Analysis -->
                <div class="rounded-md border border-gray-200 overflow-hidden dark:border-gray-700">
                  <div class="bg-gray-50 px-4 py-3 dark:bg-blue-gray-700">
                    <h5 class="text-sm font-medium text-gray-900 dark:text-white">Readability Analysis</h5>
                  </div>
                  <div class="px-4 py-3 divide-y divide-gray-200 dark:divide-gray-700">
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Good use of headings</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your content uses proper heading structure</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-alert-02 h-5 w-5 text-yellow-500 dark:text-yellow-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Paragraph length</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Some paragraphs are too long. Consider breaking them up for better readability.</p>
                      </div>
                    </div>
                    <div class="py-3 flex items-start">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Reading ease score is good</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Your content has a Flesch reading ease score of 68, which is considered good</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Improvement Suggestions -->
              <div class="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <div class="i-hugeicons-idea-01 h-5 w-5 text-blue-400"></div>
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-blue-800 dark:text-blue-300">Improvement Suggestions</h3>
                    <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
                      <ul class="list-disc space-y-1 pl-5">
                        <li>Add alt tags to all images</li>
                        <li>Increase content length to at least 1000 words</li>
                        <li>Break up longer paragraphs for better readability</li>
                        <li>Add more internal links to related content</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="openEditModal(seoData.find(item => item.id === analysisPostId) as SeoSettings)"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Edit SEO Settings
            </button>
            <button
              type="button"
              @click="closeAnalysisModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
