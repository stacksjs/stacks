<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Blog Categories',
})

// Define category type
interface Category {
  id: number
  name: string
  slug: string
  description: string
  postCount: number
  createdAt: string
}

// Sample categories data
const categories = ref<Category[]>([
  {
    id: 1,
    name: 'Technology',
    slug: 'technology',
    description: 'Latest technology news, trends, and innovations',
    postCount: 28,
    createdAt: '2023-10-10',
  },
  {
    id: 2,
    name: 'Tutorials',
    slug: 'tutorials',
    description: 'Step-by-step guides and how-to articles',
    postCount: 42,
    createdAt: '2023-10-12',
  },
  {
    id: 3,
    name: 'Reviews',
    slug: 'reviews',
    description: 'Product and service reviews and comparisons',
    postCount: 15,
    createdAt: '2023-10-15',
  },
  {
    id: 4,
    name: 'News',
    slug: 'news',
    description: 'Latest industry news and updates',
    postCount: 31,
    createdAt: '2023-10-18',
  },
  {
    id: 5,
    name: 'Opinion',
    slug: 'opinion',
    description: 'Editorial content and opinion pieces',
    postCount: 12,
    createdAt: '2023-10-20',
  },
  {
    id: 6,
    name: 'Development',
    slug: 'development',
    description: 'Software development topics and trends',
    postCount: 24,
    createdAt: '2023-10-22',
  },
  {
    id: 7,
    name: 'Design',
    slug: 'design',
    description: 'UI/UX design principles and case studies',
    postCount: 18,
    createdAt: '2023-10-25',
  },
  {
    id: 8,
    name: 'Security',
    slug: 'security',
    description: 'Cybersecurity news, tips, and best practices',
    postCount: 14,
    createdAt: '2023-10-28',
  },
  {
    id: 9,
    name: 'Mobile',
    slug: 'mobile',
    description: 'Mobile development and app reviews',
    postCount: 20,
    createdAt: '2023-11-01',
  },
  {
    id: 10,
    name: 'Cloud',
    slug: 'cloud',
    description: 'Cloud computing services and solutions',
    postCount: 16,
    createdAt: '2023-11-05',
  },
  {
    id: 11,
    name: 'AI',
    slug: 'ai',
    description: 'Artificial intelligence and machine learning',
    postCount: 22,
    createdAt: '2023-11-10',
  },
  {
    id: 12,
    name: 'DevOps',
    slug: 'devops',
    description: 'DevOps practices, tools, and culture',
    postCount: 10,
    createdAt: '2023-11-15',
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('postCount')
const sortOrder = ref('desc')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// New Category Modal
interface NewCategoryForm {
  name: string
  slug: string | undefined
  description: string
}

const newCategory = ref<NewCategoryForm>({
  name: '',
  slug: undefined,
  description: ''
})
const showNewCategoryModal = ref(false)

// Edit Category Modal
const showEditModal = ref(false)
const categoryToEdit = ref<Category | null>(null)

// Delete Confirmation Modal
const showDeleteModal = ref(false)
const categoryToDelete = ref<Category | null>(null)
const selectedCategoryIds = ref<number[]>([])
const selectAll = ref(false)

// Computed properties
const filteredCategories = computed(() => {
  let result = [...categories.value]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(category =>
      category.name.toLowerCase().includes(query) ||
      category.description.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result.sort((a, b) => {
    const sortField = sortBy.value as keyof Category
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
const totalPages = computed(() => Math.ceil(filteredCategories.value.length / itemsPerPage.value))

const paginatedCategories = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredCategories.value.slice(startIndex, endIndex)
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
function openNewCategoryModal(): void {
  newCategory.value = {
    name: '',
    slug: undefined,
    description: ''
  }
  showNewCategoryModal.value = true
}

function closeNewCategoryModal(): void {
  showNewCategoryModal.value = false
}

function createCategory(): void {
  // Validate required fields
  if (!newCategory.value.name) return

  // Generate slug if not provided
  let slug = newCategory.value.slug
  if (!slug) {
    slug = newCategory.value.name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
  }

  const newId = Math.max(...categories.value.map(c => c.id)) + 1

  categories.value.push({
    id: newId,
    name: newCategory.value.name,
    slug: slug,
    description: newCategory.value.description,
    postCount: 0,
    createdAt: new Date().toISOString().split('T')[0]
  })

  closeNewCategoryModal()
}

function openEditModal(category: Category): void {
  categoryToEdit.value = { ...category }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
}

function updateCategory(): void {
  if (!categoryToEdit.value) return

  const index = categories.value.findIndex(c => c.id === categoryToEdit.value!.id)
  if (index !== -1) {
    // Generate slug if not provided
    let slug = categoryToEdit.value.slug
    if (!slug) {
      slug = categoryToEdit.value.name
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-')
    }

    categories.value[index] = {
      ...categoryToEdit.value,
      slug: slug
    }
  }

  closeEditModal()
}

function confirmDeleteCategory(category: Category): void {
  categoryToDelete.value = category
  selectedCategoryIds.value = []
  showDeleteModal.value = true
}

function confirmDeleteSelected(): void {
  showDeleteModal.value = true
}

function closeDeleteModal(): void {
  showDeleteModal.value = false
  categoryToDelete.value = null
}

function deleteSelectedCategories(): void {
  if (selectedCategoryIds.value.length > 1) {
    // Delete multiple categories
    categories.value = categories.value.filter(category => !selectedCategoryIds.value.includes(category.id))
    selectedCategoryIds.value = []
  } else if (categoryToDelete.value) {
    // Delete single category
    categories.value = categories.value.filter(category => category.id !== categoryToDelete.value!.id)
  }

  closeDeleteModal()
}

function toggleSelectAll(): void {
  if (selectAll.value) {
    // Select all categories on current page
    selectedCategoryIds.value = paginatedCategories.value.map(category => category.id)
  } else {
    // Deselect all
    selectedCategoryIds.value = []
  }
}

function toggleCategorySelection(categoryId: number): void {
  const index = selectedCategoryIds.value.indexOf(categoryId)
  if (index === -1) {
    selectedCategoryIds.value.push(categoryId)
  } else {
    selectedCategoryIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all categories are selected
  selectAll.value = paginatedCategories.value.every(category => selectedCategoryIds.value.includes(category.id))
}

const hasSelectedCategories = computed(() => selectedCategoryIds.value.length > 0)
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Categories</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage all your blog categories
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openNewCategoryModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              New Category
            </button>
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
              placeholder="Search categories..."
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

        <!-- Bulk actions -->
        <div v-if="hasSelectedCategories" class="mt-4 bg-blue-50 p-4 rounded-lg shadow-sm dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-check-circle h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-800 dark:text-blue-300">{{ selectedCategoryIds.length }} categories selected</span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="confirmDeleteSelected"
                class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 dark:bg-blue-gray-800 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
              >
                <div class="i-hugeicons-trash-03 h-4 w-4 mr-1"></div>
                Delete Selected
              </button>
            </div>
          </div>
        </div>

        <!-- Categories Table -->
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
                      Name
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Description
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Slug
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Posts
                    </th>
                    <th scope="col" class="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Created
                    </th>
                    <th scope="col" class="relative px-4 py-3.5">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="category in paginatedCategories" :key="category.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                    <td class="relative px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          :checked="selectedCategoryIds.includes(category.id)"
                          @change="toggleCategorySelection(category.id)"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:checked:bg-blue-600 dark:focus:ring-offset-blue-gray-800"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ category.name }}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4">
                      <div class="text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                        {{ category.description }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-500 dark:text-gray-300">
                        {{ category.slug }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-500 dark:text-gray-300">
                        {{ category.postCount }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-500 dark:text-gray-300">
                        {{ category.createdAt }}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button
                          @click="openEditModal(category)"
                          class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <div class="i-hugeicons-pencil-01 h-5 w-5"></div>
                          <span class="sr-only">Edit</span>
                        </button>
                        <button
                          @click="confirmDeleteCategory(category)"
                          class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <div class="i-hugeicons-trash-03 h-5 w-5"></div>
                          <span class="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedCategories.length === 0">
                    <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No categories found. Try adjusting your search or create a new category.
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
                Showing <span class="font-medium">{{ ((currentPage - 1) * itemsPerPage) + 1 }}</span> to <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredCategories.length) }}</span> of <span class="font-medium">{{ filteredCategories.length }}</span> results
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

  <!-- New Category Modal -->
  <div v-if="showNewCategoryModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              @click="closeNewCategoryModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-plus-sign h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">New Category</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Create a new category for your blog posts.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <div>
                <label for="category-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Name</label>
                <div class="mt-2">
                  <input
                    type="text"
                    id="category-name"
                    v-model="newCategory.name"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                    placeholder="e.g. Technology"
                  />
                </div>
              </div>
              <div>
                <label for="category-slug" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Slug</label>
                <div class="mt-2">
                  <input
                    type="text"
                    id="category-slug"
                    v-model="newCategory.slug"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                    placeholder="e.g. technology"
                  />
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to generate automatically from the name.
                </p>
              </div>
              <div>
                <label for="category-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Description</label>
                <div class="mt-2">
                  <textarea
                    id="category-description"
                    v-model="newCategory.description"
                    rows="3"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                    placeholder="Describe this category..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="createCategory"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
              :disabled="!newCategory.name"
            >
              Create
            </button>
            <button
              type="button"
              @click="closeNewCategoryModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Category Modal -->
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
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900/30">
              <div class="i-hugeicons-pencil-01 h-6 w-6 text-blue-600 dark:text-blue-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">Edit Category</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Update the details for this category.
                </p>
              </div>
            </div>
          </div>
          <div v-if="categoryToEdit" class="mt-5 sm:mt-4">
            <div class="space-y-4">
              <div>
                <label for="edit-category-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Name</label>
                <div class="mt-2">
                  <input
                    type="text"
                    id="edit-category-name"
                    v-model="categoryToEdit.name"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div>
                <label for="edit-category-slug" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Slug</label>
                <div class="mt-2">
                  <input
                    type="text"
                    id="edit-category-slug"
                    v-model="categoryToEdit.slug"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  />
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to generate automatically from the name.
                </p>
              </div>
              <div>
                <label for="edit-category-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-white">Description</label>
                <div class="mt-2">
                  <textarea
                    id="edit-category-description"
                    v-model="categoryToEdit.description"
                    rows="3"
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="updateCategory"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
              :disabled="!categoryToEdit || !categoryToEdit.name"
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
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-red-900/30">
              <div class="i-hugeicons-exclamation-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">
                {{ selectedCategoryIds.length > 1 ? 'Delete Categories' : 'Delete Category' }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ selectedCategoryIds.length > 1
                    ? `Are you sure you want to delete these ${selectedCategoryIds.length} categories? This action cannot be undone.`
                    : 'Are you sure you want to delete this category? This action cannot be undone.'
                  }}
                </p>
                <div v-if="selectedCategoryIds.length > 1" class="mt-4 max-h-40 overflow-y-auto">
                  <ul class="space-y-2">
                    <li v-for="id in selectedCategoryIds" :key="id" class="text-sm text-gray-700 dark:text-gray-300">
                      {{ categories.find((c: Category) => c.id === id)?.name }}
                    </li>
                  </ul>
                </div>
                <div v-else-if="categoryToDelete" class="mt-4">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ categoryToDelete.name }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="deleteSelectedCategories"
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
