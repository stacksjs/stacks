<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import type { Taggables } from '../../../../types/defaults'
import { useTaggables } from '../../../../functions/cms/taggables'

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
  title: 'Dashboard - Blog Tags',
})

const taggablesModule = useTaggables()

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

  // Sample data - in a real app, this would be calculated from actual tag data
  const tagGrowthData = [5, 6, 7, 8, 8, 9, 10, 10, 11, 11, 12, 12]

  // Tag growth chart data
  const tagGrowthChartData = {
    labels: months,
    datasets: [
      {
        label: 'Tags',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: tagGrowthData,
      },
    ],
  }

  // Posts per tag chart data
  const postCountData = tags.value.map(tag => tag.postCount)
  const tagNames = tags.value.map(tag => tag.name)

  const postsPerTagChartData = {
    labels: tagNames,
    datasets: [
      {
        label: 'Posts',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: postCountData,
      },
    ],
  }

  // Tag distribution chart data
  const backgroundColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(75, 85, 99, 0.8)',
    'rgba(14, 165, 233, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(234, 88, 12, 0.8)',
    'rgba(217, 119, 6, 0.8)',
  ]

  const tagDistributionChartData = {
    labels: tagNames,
    datasets: [
      {
        data: postCountData,
        backgroundColor: backgroundColors.slice(0, tagNames.length),
        borderWidth: 0,
      },
    ],
  }

  return {
    tagGrowthChartData,
    postsPerTagChartData,
    tagDistributionChartData,
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Tags data
const tags = ref<Taggables[]>([])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('postCount')
const sortOrder = ref('desc')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// New Tag Modal
interface NewTagForm {
  name: string
  slug: string | undefined
  description: string
}

const newTag = ref<NewTagForm>({
  name: '',
  slug: undefined,
  description: ''
})
const showNewTagModal = ref(false)
const newTagErrors = ref({
  name: '',
})

// Edit Tag Modal
const showEditModal = ref(false)
const tagToEdit = ref<Taggables | null>(null)
const editTagErrors = ref({
  name: '',
})

// Delete Confirmation Modal
const showDeleteModal = ref(false)
const tagToDelete = ref<Taggables | null>(null)
const selectedTagIds = ref<number[]>([])
const selectAll = ref(false)

// Computed properties
const filteredTags = computed(() => {
  let result = [...tags.value]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(tag =>
      tag.name.toLowerCase().includes(query) ||
      tag.description.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result.sort((a, b) => {
    const sortField = sortBy.value as keyof typeof a
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
const totalPages = computed(() => Math.ceil(filteredTags.value.length / itemsPerPage.value))

const paginatedTags = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredTags.value.slice(startIndex, endIndex)
})

const paginationRange = computed(() => {
  const range: (number | string)[] = []
  const maxVisiblePages = 5
  const startPage = Math.max(1, currentPage.value - Math.floor(maxVisiblePages / 2))
  const endPage = Math.min(totalPages.value, startPage + maxVisiblePages - 1)

  if (startPage > 1) {
    range.push(1)
    if (startPage > 2) range.push('...')
  }

  for (let i = startPage; i <= endPage; i++) {
    range.push(i)
  }

  if (endPage < totalPages.value) {
    if (endPage < totalPages.value - 1) range.push('...')
    range.push(totalPages.value)
  }

  return range
})

// Computed tag statistics
const tagStats = computed(() => {
  // Total number of tags
  const totalTags = tags.value.length

  // Total number of posts across all tags
  const totalPosts = tags.value.reduce((sum, tag) => sum + (tag.postCount || 0), 0)

  // Average posts per tag
  const avgPostsPerTag = totalTags > 0
    ? (totalPosts / totalTags).toFixed(1)
    : '0.0'

  // Find tag with most posts
  let mostPopularTag = tags.value[0] || { name: 'None', postCount: 0 }

  for (const tag of tags.value) {
    if ((tag.postCount || 0) > (mostPopularTag.postCount || 0)) {
      mostPopularTag = tag
    }
  }

  // Find tag with least posts
  let leastPopularTag = tags.value[0] || { name: 'None', postCount: 0 }

  for (const tag of tags.value) {
    if ((tag.postCount || 0) < (leastPopularTag.postCount || 0)) {
      leastPopularTag = tag
    }
  }

  // Calculate percentage of posts in top tag
  const topTagPercentage = totalPosts > 0
    ? (((mostPopularTag.postCount || 0) / totalPosts) * 100).toFixed(1)
    : '0.0'

  // Find newest tag
  let newestTag = tags.value[0] || { name: 'None', created_at: '' } as Taggables

  for (const tag of tags.value) {
    if (new Date(tag.created_at || '') > new Date(newestTag.created_at || '')) {
      newestTag = tag
    }
  }

  return {
    totalTags,
    totalPosts,
    avgPostsPerTag,
    mostPopularTag,
    leastPopularTag,
    topTagPercentage,
    newestTag
  }
})

// Methods
function toggleSort(field: string): void {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
}

function openNewTagModal(): void {
  newTag.value = {
    name: '',
    slug: undefined,
    description: ''
  }
  showNewTagModal.value = true
}

function closeNewTagModal(): void {
  showNewTagModal.value = false
}

async function createTag(): Promise<void> {
  // Validate required fields
  if (!newTag.value.name) return

  const tag = {
    name: newTag.value.name,
    description: newTag.value.description,
    is_active: true,
  }

  await taggablesModule.createTaggable(tag)
  closeNewTagModal()
}

function openEditModal(tag: Taggables): void {
  tagToEdit.value = { ...tag }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
}

function updateTag(): void {
  if (!tagToEdit.value) return

  const index = tags.value.findIndex(t => t.id === tagToEdit.value!.id)
  if (index !== -1) {
    // Generate slug if not provided
    let slug = tagToEdit.value.slug
    if (!slug) {
      slug = tagToEdit.value.name
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-')
    }

    tags.value[index] = {
      ...tagToEdit.value,
      slug: slug
    }
  }

  closeEditModal()
}

function confirmDeleteTag(tag: Taggables): void {
  tagToDelete.value = tag
  selectedTagIds.value = []
  showDeleteModal.value = true
}

function confirmDeleteSelected(): void {
  showDeleteModal.value = true
}

function closeDeleteModal(): void {
  showDeleteModal.value = false
  tagToDelete.value = null
}

function deleteSelectedTags(): void {
  if (selectedTagIds.value.length > 1) {
    // Delete multiple tags
    tags.value = tags.value.filter(tag => !selectedTagIds.value.includes(tag.id))
    selectedTagIds.value = []
  } else if (tagToDelete.value) {
    // Delete single tag
    tags.value = tags.value.filter(tag => tag.id !== tagToDelete.value!.id)
  }

  closeDeleteModal()
}

function toggleSelectAll(): void {
  if (selectAll.value) {
    // Select all tags on current page
    selectedTagIds.value = paginatedTags.value.map(tag => tag.id)
  } else {
    // Deselect all
    selectedTagIds.value = []
  }
}

function toggleTagSelection(tagId: number): void {
  const index = selectedTagIds.value.indexOf(tagId)
  if (index === -1) {
    selectedTagIds.value.push(tagId)
  } else {
    selectedTagIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all tags are selected
  selectAll.value = paginatedTags.value.every(tag => selectedTagIds.value.includes(tag.id))
}

const hasSelectedTags = computed(() => selectedTagIds.value.length > 0)

onMounted(async () => {
  await fetchTags()
})

async function fetchTags() {
  const allTags = await taggablesModule.fetchTaggables()
  tags.value = allTags
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<template>
  <main class="p-6 space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Tags</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your blog tags
        </p>
      </div>
      <button
        @click="openNewTagModal"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        New Tag
      </button>
    </div>

    <!-- Time Range Selector -->
    <div class="flex justify-end">
      <div class="relative inline-block w-full sm:w-auto">
        <select
          v-model="timeRange"
          class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
        >
          <option v-for="range in timeRanges" :key="range">{{ range }}</option>
        </select>
      </div>
    </div>

    <!-- Enhanced Tag Statistics -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Total Tags -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-indigo-500 rounded-md p-3">
              <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Tags
                </dt>
                <dd>
                  <div class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ tagStats.totalTags }}
                  </div>
                  <div class="mt-1 text-sm text-green-600 dark:text-green-400">
                    <span>{{ tagStats.newestTag.name }} added recently</span>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Posts Tagged -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-green-500 rounded-md p-3">
              <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Posts Tagged
                </dt>
                <dd>
                  <div class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ tagStats.totalPosts }}
                  </div>
                  <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>{{ tagStats.avgPostsPerTag }} avg per tag</span>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Most Used Tag -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-purple-500 rounded-md p-3">
              <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Most Used Tag
                </dt>
                <dd>
                  <div class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ tagStats.mostPopularTag ? tagStats.mostPopularTag.name : 'None' }}
                  </div>
                  <div class="mt-1 text-sm text-green-600 dark:text-green-400">
                    <span v-if="tagStats.mostPopularTag">{{ tagStats.mostPopularTag.postCount }} posts ({{ tagStats.topTagPercentage }}%)</span>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Least Used Tag -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-blue-500 rounded-md p-3">
              <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Least Used Tag
                </dt>
                <dd>
                  <div class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ tagStats.leastPopularTag ? tagStats.leastPopularTag.name : 'None' }}
                  </div>
                  <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span v-if="tagStats.leastPopularTag">{{ tagStats.leastPopularTag.postCount }} posts</span>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- Tag Growth Chart -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Tag Growth</h3>
          <div class="mt-4" style="height: 250px;">
            <Line :data="monthlyChartData.tagGrowthChartData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <!-- Posts Per Tag Chart -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Posts Per Tag</h3>
          <div class="mt-4" style="height: 250px;">
            <Bar :data="monthlyChartData.postsPerTagChartData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <!-- Tag Distribution Chart -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Tag Distribution</h3>
          <div class="mt-4" style="height: 250px;">
            <Doughnut :data="monthlyChartData.tagDistributionChartData" :options="doughnutChartOptions" />
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="relative max-w-sm">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
          placeholder="Search tags..."
        />
      </div>

      <div class="flex flex-col sm:flex-row gap-4">
        <select
          v-model="sortBy"
          class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
        >
          <option value="name">Sort by Name</option>
          <option value="postCount">Sort by Post Count</option>
          <option value="created_at">Sort by Created Date</option>
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

    <!-- Tags Table -->
    <div class="mt-6 flow-root">
      <div class="sm:flex sm:items-center sm:justify-between mb-4">
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Tags</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A list of all blog tags including name, description, and post count.
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
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                    <button @click="toggleSort('name')" class="group inline-flex items-center">
                      Name
                      <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        <div v-if="sortBy === 'name'" :class="[
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                          'h-4 w-4'
                        ]"></div>
                        <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                    Description
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                    <button @click="toggleSort('postCount')" class="group inline-flex items-center">
                      Posts
                      <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        <div v-if="sortBy === 'postCount'" :class="[
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                          'h-4 w-4'
                        ]"></div>
                        <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                    <button @click="toggleSort('created_at')" class="group inline-flex items-center">
                      Created
                      <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        <div v-if="sortBy === 'created_at'" :class="[
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                          'h-4 w-4'
                        ]"></div>
                        <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                <tr v-for="tag in paginatedTags" :key="tag.id" :class="{ 'bg-blue-50 dark:bg-blue-900/10': selectedTagIds.includes(tag.id) }">
                  <td class="relative py-4 pl-3 pr-4 text-sm font-medium sm:pr-6">
                    <div class="flex items-center">
                      <input
                        :id="`tag-${tag.id}`"
                        type="checkbox"
                        :checked="selectedTagIds.includes(tag.id)"
                        @change="toggleTagSelection(tag.id)"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                      />
                    </div>
                  </td>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-md">
                        <div class="i-hugeicons-tag-01 h-5 w-5 text-blue-600 dark:text-blue-400"></div>
                      </div>
                      <div class="ml-4">
                        <div class="font-medium">{{ tag.name }}</div>
                        <div class="mt-1 text-gray-500 dark:text-gray-400 text-xs">{{ tag.slug }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <div class="line-clamp-2">{{ tag.description }}</div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {{ tag.postCount }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {{ formatDate(tag.created_at) }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div class="flex items-center justify-end space-x-2">
                      <button
                        @click="openEditModal(tag)"
                        class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      </button>
                      <button
                        @click="confirmDeleteTag(tag)"
                        class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <div class="i-hugeicons-waste h-5 w-5"></div>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="paginatedTags.length === 0">
                  <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No tags found. Create a new tag to get started.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div v-if="hasSelectedTags" class="mt-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="i-hugeicons-check-circle-02 h-5 w-5 text-blue-600 dark:text-blue-400 mr-2"></div>
          <span class="text-sm font-medium text-blue-800 dark:text-blue-300">{{ selectedTagIds.length }} tags selected</span>
        </div>
        <div class="flex space-x-2">
          <button
            @click="confirmDeleteSelected"
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <div class="i-hugeicons-waste h-4 w-4 mr-1.5"></div>
            Delete Selected
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 dark:bg-blue-gray-800 px-4 py-3 sm:px-6">
      <div class="flex flex-1 justify-between sm:hidden">
        <button
          @click="currentPage > 1 ? currentPage-- : null"
          :disabled="currentPage === 1"
          :class="[
            currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
            'relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 dark:bg-blue-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200'
          ]"
        >
          Previous
        </button>
        <button
          @click="currentPage < totalPages ? currentPage++ : null"
          :disabled="currentPage === totalPages"
          :class="[
            currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
            'relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200'
          ]"
        >
          Next
        </button>
      </div>
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Showing
            <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span>
            to
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredTags.length) }}</span>
            of
            <span class="font-medium">{{ filteredTags.length }}</span>
            results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              @click="currentPage > 1 ? currentPage-- : null"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-700 focus:z-20 focus:outline-offset-0"
              :class="{ 'cursor-not-allowed opacity-50': currentPage === 1 }"
            >
              <span class="sr-only">Previous</span>
              <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
            </button>
            <template v-for="page in paginationRange" :key="page">
              <button
                v-if="page !== '...'"
                @click="currentPage = typeof page === 'number' ? page : currentPage"
                :class="[
                  page === currentPage
                    ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                    : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-700 focus:z-20 focus:outline-offset-0',
                ]"
              >
                {{ page }}
              </button>
              <span
                v-else
                class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                ...
              </span>
            </template>
            <button
              @click="currentPage < totalPages ? currentPage++ : null"
              :disabled="currentPage === totalPages"
              class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-700 focus:z-20 focus:outline-offset-0"
              :class="{ 'cursor-not-allowed opacity-50': currentPage === totalPages }"
            >
              <span class="sr-only">Next</span>
              <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
            </button>
          </nav>
        </div>
      </div>
    </div>

    <!-- New Tag Modal -->
    <div v-if="showNewTagModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeNewTagModal"></div>
        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
            <button type="button" @click="closeNewTagModal" class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>
          <div>
            <div class="mt-3 text-center sm:mt-0 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">
                Create New Tag
              </h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="new-tag-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="new-tag-name"
                        v-model="newTag.name"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        :class="{ 'border-red-500 dark:border-red-500': newTagErrors.name }"
                        placeholder="Enter tag name"
                      />
                      <p v-if="newTagErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ newTagErrors.name }}</p>
                    </div>
                  </div>
                  <div>
                    <label for="new-tag-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="new-tag-description"
                        v-model="newTag.description"
                        rows="3"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        placeholder="Enter tag description"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="createTag"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
            >
              Create
            </button>
            <button
              type="button"
              @click="closeNewTagModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Tag Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeEditModal"></div>
        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
            <button type="button" @click="closeEditModal" class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>
          <div>
            <div class="mt-3 text-center sm:mt-0 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">
                Edit Tag
              </h3>
              <div class="mt-4">
                <div v-if="tagToEdit" class="space-y-4">
                  <div>
                    <label for="edit-tag-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="edit-tag-name"
                        v-model="tagToEdit.name"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        :class="{ 'border-red-500 dark:border-red-500': editTagErrors.name }"
                        placeholder="Enter tag name"
                      />
                      <p v-if="editTagErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ editTagErrors.name }}</p>
                    </div>
                  </div>
                  <div>
                    <label for="edit-tag-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="edit-tag-description"
                        v-model="tagToEdit.description"
                        rows="3"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        placeholder="Enter tag description"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="updateTag"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
            >
              Update
            </button>
            <button
              type="button"
              @click="closeEditModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeDeleteModal"></div>
        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
            <button type="button" @click="closeDeleteModal" class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>
          <div>
            <div class="flex items-center justify-center h-12 w-12 mx-auto rounded-full bg-red-100 dark:bg-red-900">
              <div class="i-hugeicons-exclamation-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">
                {{ selectedTagIds.length > 1 ? 'Delete Selected Tags' : 'Delete Tag' }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ selectedTagIds.length > 1
                    ? `Are you sure you want to delete ${selectedTagIds.length} selected tags? This action cannot be undone.`
                    : `Are you sure you want to delete this tag? This action cannot be undone.`
                  }}
                </p>

                <!-- Show list of tags to be deleted if multiple are selected -->
                <div v-if="selectedTagIds.length > 1" class="mt-4 max-h-40 overflow-y-auto">
                  <ul class="divide-y divide-gray-200 dark:divide-gray-700 text-left">
                    <li v-for="id in selectedTagIds" :key="id" class="py-2 px-4 flex items-center">
                      <div class="flex-shrink-0 h-6 w-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-md mr-3">
                        <div class="i-hugeicons-tag-01 h-4 w-4 text-blue-600 dark:text-blue-400"></div>
                      </div>
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ tags.find(tag => tag.id === id)?.name }}</span>
                    </li>
                  </ul>
                </div>

                <!-- Show single tag name if only one is selected -->
                <div v-else-if="tagToDelete" class="mt-4 text-center">
                  <div class="inline-flex items-center justify-center px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <span class="text-sm font-medium text-red-800 dark:text-red-400">{{ tags.find(tag => tag.id === tagToDelete?.id)?.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="deleteSelectedTags"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
            >
              Delete
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
