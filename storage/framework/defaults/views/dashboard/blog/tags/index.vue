<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Blog Tags',
})

// Sample tags data
const tags = ref([
  {
    id: 1,
    name: 'JavaScript',
    slug: 'javascript',
    description: 'All posts related to JavaScript programming language',
    postCount: 24,
    createdAt: '2023-10-15',
  },
  {
    id: 2,
    name: 'Vue',
    slug: 'vue',
    description: 'Vue.js framework tutorials and guides',
    postCount: 18,
    createdAt: '2023-10-15',
  },
  {
    id: 3,
    name: 'React',
    slug: 'react',
    description: 'React library tutorials and guides',
    postCount: 15,
    createdAt: '2023-10-20',
  },
  {
    id: 4,
    name: 'CSS',
    slug: 'css',
    description: 'CSS styling techniques and best practices',
    postCount: 12,
    createdAt: '2023-10-22',
  },
  {
    id: 5,
    name: 'TypeScript',
    slug: 'typescript',
    description: 'TypeScript language features and tips',
    postCount: 10,
    createdAt: '2023-10-25',
  },
  {
    id: 6,
    name: 'Web Development',
    slug: 'web-development',
    description: 'General web development topics',
    postCount: 30,
    createdAt: '2023-10-10',
  },
  {
    id: 7,
    name: 'Performance',
    slug: 'performance',
    description: 'Web performance optimization techniques',
    postCount: 8,
    createdAt: '2023-10-28',
  },
  {
    id: 8,
    name: 'Accessibility',
    slug: 'accessibility',
    description: 'Web accessibility guidelines and implementations',
    postCount: 6,
    createdAt: '2023-11-01',
  },
  {
    id: 9,
    name: 'Node.js',
    slug: 'nodejs',
    description: 'Node.js backend development',
    postCount: 14,
    createdAt: '2023-11-05',
  },
  {
    id: 10,
    name: 'API',
    slug: 'api',
    description: 'API design and implementation',
    postCount: 9,
    createdAt: '2023-11-10',
  },
  {
    id: 11,
    name: 'Best Practices',
    slug: 'best-practices',
    description: 'Coding best practices and standards',
    postCount: 16,
    createdAt: '2023-11-15',
  },
  {
    id: 12,
    name: 'Frontend',
    slug: 'frontend',
    description: 'Frontend development techniques',
    postCount: 22,
    createdAt: '2023-11-20',
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('postCount')
const sortOrder = ref('desc')

// New Tag Modal
const showNewTagModal = ref(false)
const newTag = ref({
  name: '',
  description: '',
})
const newTagErrors = ref({
  name: '',
})

// Edit Tag Modal
const showEditTagModal = ref(false)
const editTag = ref<{
  id: number;
  name: string;
  slug: string;
  description: string;
  postCount: number;
  createdAt: string;
} | null>(null)
const editTagErrors = ref({
  name: '',
})

function openNewTagModal() {
  showNewTagModal.value = true
  // Reset errors
  newTagErrors.value = { name: '' }
}

function closeNewTagModal() {
  showNewTagModal.value = false
  // Reset form
  newTag.value = {
    name: '',
    description: '',
  }
  // Reset errors
  newTagErrors.value = { name: '' }
}

function validateNewTag(): boolean {
  let isValid = true
  newTagErrors.value = { name: '' }

  if (!newTag.value.name.trim()) {
    newTagErrors.value.name = 'Tag name is required'
    isValid = false
  }

  return isValid
}

function createNewTag() {
  // Validate form
  if (!validateNewTag()) {
    return
  }

  // In a real app, this would send data to the server
  const tag = {
    id: tags.value.length + 1,
    name: newTag.value.name.trim(),
    slug: newTag.value.name.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-'),
    description: newTag.value.description.trim(),
    postCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
  } as typeof tags.value[0]

  tags.value.unshift(tag)
  closeNewTagModal()
}

function openEditTagModal(tag: typeof tags.value[0]) {
  editTag.value = { ...tag }
  showEditTagModal.value = true
  // Reset errors
  editTagErrors.value = { name: '' }
}

function closeEditTagModal() {
  showEditTagModal.value = false
  editTag.value = null
  // Reset errors
  editTagErrors.value = { name: '' }
}

function validateEditTag(): boolean {
  let isValid = true
  editTagErrors.value = { name: '' }

  if (!editTag.value?.name.trim()) {
    editTagErrors.value.name = 'Tag name is required'
    isValid = false
  }

  return isValid
}

function updateTag() {
  if (!editTag.value) return

  // Validate form
  if (!validateEditTag()) {
    return
  }

  const index = tags.value.findIndex(tag => tag.id === editTag.value?.id)
  if (index !== -1 && editTag.value) {
    // Create a copy of the editing tag with all required properties
    const updatedTag = {
      id: editTag.value.id,
      name: editTag.value.name.trim(),
      slug: editTag.value.slug.trim() || editTag.value.name.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-'),
      description: editTag.value.description.trim(),
      postCount: editTag.value.postCount,
      // Use a default value if createdAt is undefined
      createdAt: editTag.value.createdAt || new Date().toISOString().split('T')[0]
    } as typeof tags.value[0]

    // Update the tag in the array
    tags.value[index] = updatedTag
  }

  closeEditTagModal()
}

function deleteTag(id: number) {
  const index = tags.value.findIndex(tag => tag.id === id)
  if (index !== -1) {
    tags.value.splice(index, 1)
  }
}

// Computed filtered and sorted tags
const filteredTags = computed(() => {
  return tags.value
    .filter(tag => {
      // Apply search filter
      return tag.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        tag.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'postCount') {
        comparison = a.postCount - b.postCount
      } else if (sortBy.value === 'createdAt') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Tag statistics
const tagStats = computed(() => {
  const totalTags = tags.value.length
  const totalPosts = tags.value.reduce((sum, tag) => sum + tag.postCount, 0)
  const mostUsedTag = [...tags.value].sort((a, b) => b.postCount - a.postCount)[0]

  return {
    totalTags,
    totalPosts,
    mostUsedTag
  }
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalPages = computed(() => Math.ceil(filteredTags.value.length / itemsPerPage.value))

const paginatedTags = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredTags.value.slice(start, end)
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

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Bulk actions
const selectedTagIds = ref<number[]>([])
const selectAll = ref(false)

// Delete confirmation
const showDeleteModal = ref(false)
const tagToDelete = ref<number | null>(null)

function toggleSelectAll(): void {
  if (selectAll.value) {
    selectedTagIds.value = paginatedTags.value.map(tag => tag.id)
  } else {
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

function confirmDeleteTag(id: number): void {
  tagToDelete.value = id
  showDeleteModal.value = true
}

function confirmDeleteSelected(): void {
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  tagToDelete.value = null
}

function deleteSelectedTags(): void {
  if (selectedTagIds.value.length > 1) {
    // Delete all selected tags
    selectedTagIds.value.forEach(id => {
      const index = tags.value.findIndex(tag => tag.id === id)
      if (index !== -1) {
        tags.value.splice(index, 1)
      }
    })
    selectedTagIds.value = []
    selectAll.value = false
  } else if (tagToDelete.value !== null) {
    // Delete single tag
    const index = tags.value.findIndex(tag => tag.id === tagToDelete.value)
    if (index !== -1) {
      tags.value.splice(index, 1)
    }
  }

  showDeleteModal.value = false
  tagToDelete.value = null
}

const hasSelectedTags = computed(() => selectedTagIds.value.length > 0)

// Fix the paginationRange computed property to ensure it returns only numbers or strings
const paginationRange = computed(() => {
  const range: (number | string)[] = [];
  const maxVisiblePages = 5;

  if (totalPages.value <= maxVisiblePages) {
    // If we have less pages than the max visible, show all pages
    for (let i = 1; i <= totalPages.value; i++) {
      range.push(i);
    }
  } else {
    // Always show first page
    range.push(1);

    // Calculate start and end of the visible range
    let start = Math.max(2, currentPage.value - 1);
    let end = Math.min(totalPages.value - 1, currentPage.value + 1);

    // Adjust the range to always show 3 pages in the middle
    if (start === 2) end = Math.min(4, totalPages.value - 1);
    if (end === totalPages.value - 1) start = Math.max(2, totalPages.value - 3);

    // Add ellipsis if needed before the visible range
    if (start > 2) range.push('...');

    // Add the visible range
    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    // Add ellipsis if needed after the visible range
    if (end < totalPages.value - 1) range.push('...');

    // Always show last page
    range.push(totalPages.value);
  }

  return range;
});
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

    <!-- Tag Statistics -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    {{ tagStats.mostUsedTag ? tagStats.mostUsedTag.name : 'None' }}
                    <span v-if="tagStats.mostUsedTag" class="text-sm text-gray-500 dark:text-gray-400">
                      ({{ tagStats.mostUsedTag.postCount }} posts)
                    </span>
                  </div>
                </dd>
              </dl>
            </div>
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
          <option value="createdAt">Sort by Created Date</option>
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
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02-02',
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
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02-02',
                          'h-4 w-4'
                        ]"></div>
                        <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                    <button @click="toggleSort('createdAt')" class="group inline-flex items-center">
                      Created
                      <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        <div v-if="sortBy === 'createdAt'" :class="[
                          sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02-02',
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
                    {{ formatDate(tag.createdAt) }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div class="flex items-center justify-end space-x-2">
                      <button
                        @click="openEditTagModal(tag)"
                        class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      </button>
                      <button
                        @click="confirmDeleteTag(tag.id)"
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
            <div class="i-hugeicons-trash-bin h-4 w-4 mr-1.5"></div>
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
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
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
              @click="createNewTag"
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
    <div v-if="showEditTagModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeEditTagModal"></div>
        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
            <button type="button" @click="closeEditTagModal" class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
            </button>
          </div>
          <div>
            <div class="mt-3 text-center sm:mt-0 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">
                Edit Tag
              </h3>
              <div class="mt-4">
                <div v-if="editTag" class="space-y-4">
                  <div>
                    <label for="edit-tag-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="edit-tag-name"
                        v-model="editTag.name"
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
                        v-model="editTag.description"
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
              @click="closeEditTagModal"
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
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
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
                        <div class="i-hugeicons-tag h-4 w-4 text-blue-600 dark:text-blue-400"></div>
                      </div>
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ tags.find(tag => tag.id === id)?.name }}</span>
                    </li>
                  </ul>
                </div>

                <!-- Show single tag name if only one is selected -->
                <div v-else-if="tagToDelete" class="mt-4 text-center">
                  <div class="inline-flex items-center justify-center px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <span class="text-sm font-medium text-red-800 dark:text-red-400">{{ tags.find(tag => tag.id === tagToDelete)?.name }}</span>
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
