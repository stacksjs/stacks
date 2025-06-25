<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useCategories } from '../../../../functions/commerce/products/categories'
import CategoriesTable from '../../../../components/Dashboard/Commerce/CategoriesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import type { Categories } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Commerce Categories',
})

// Get categories data and functions from the composable
const { categories, fetchCategories, createCategory, deleteCategory: deleteCategoryFromAPI } = useCategories()

// Fetch categories on component mount
onMounted(async () => {
  await fetchCategories()
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const featuredFilter = ref('all')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Computed filtered and sorted categories
const filteredCategories = computed(() => {
  return categories.value
    .filter(category => {
      // Apply search filter
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           (category.description || '').toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply featured filter
      const matchesFeatured = featuredFilter.value === 'all' ||
                             (featuredFilter.value === 'featured' && category.is_active) ||
                             (featuredFilter.value === 'not-featured' && !category.is_active)

      return matchesSearch && matchesFeatured
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'display_order') {
        comparison = (a.display_order || 0) - (b.display_order || 0)
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Paginated categories
const paginatedCategories = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCategories.value.slice(start, end)
})

// Pagination handlers
const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredCategories.value.length / itemsPerPage.value)
  if (currentPage.value < totalPages) {
    currentPage.value++
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

// Reset to first page when search changes
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

// Modal state
const showAddModal = ref(false)
const newCategory = ref<{
  name: string;
  description: string;
  is_active: boolean;
  image_url: string;
  display_order: number;
}>({
  name: '',
  description: '',
  is_active: true,
  image_url: '',
  display_order: 0
})

// Image preview helper
const imagePreview = computed(() => {
  return newCategory.value.image_url || '/images/categories/placeholder.jpg'
})

// Handle file upload
function handleImageUpload(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]

    // In a real application, you would upload the file to a server
    // and get back a URL. For this demo, we'll simulate that by
    // creating a local object URL.
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target && e.target.result) {
        // In a real app, this would be the URL returned from the server
        newCategory.value.image_url = e.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }
}

function openAddModal(): void {
  newCategory.value = {
    name: '',
    description: '',
    is_active: true,
    image_url: '',
    display_order: 0
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

async function addCategory(): Promise<void> {
  // First add to local state for immediate UI update
  const id = Math.max(...categories.value.map(c => c.id || 0)) + 1
  
  const newCategoryData = {
    id,
    name: newCategory.value.name,
    description: newCategory.value.description,
    image_url: newCategory.value.image_url,
    is_active: newCategory.value.is_active,
    display_order: newCategory.value.display_order,
    uuid: `category-${id}`
  }
  categories.value.push(newCategoryData)

  // Then send to server
  const categoryData = {
    name: newCategory.value.name,
    description: newCategory.value.description,
    image_url: newCategory.value.image_url,
    is_active: newCategory.value.is_active,
    display_order: newCategory.value.display_order
  }

  try {
    await createCategory(categoryData as any)
    closeAddModal()
  } catch (error) {
    // If server request fails, remove from local state
    categories.value = categories.value.filter(c => c.id !== id)
    console.error('Failed to create category:', error)
  }
}

// Category actions
function viewCategory(category: Categories): void {
  console.log('View category:', category)
  // Implement view category logic
}

function editCategory(category: Categories): void {
  console.log('Edit category:', category)
  // Populate the form with existing data
  newCategory.value = {
    name: category.name,
    description: category.description || '',
    is_active: category.is_active || true,
    image_url: category.image_url || '',
    display_order: category.display_order
  }
  showAddModal.value = true
  // TODO: Change modal title to "Edit Category" when editing
}

async function handleDeleteCategory(category: Categories): Promise<void> {
  if (confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
    // Remove from local state immediately for better UX
    const originalCategories = [...categories.value]
    categories.value = categories.value.filter(c => c.id !== category.id)
    
    try {
      // Then send delete request to server
      await deleteCategoryFromAPI(category.id)
    } catch (error) {
      // If server request fails, restore the category
      categories.value = originalCategories
      console.error('Failed to delete category:', error)
    }
  }
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Categories</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your product categories
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add category
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
              @input="(event) => handleSearch((event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="featuredFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Categories</option>
              <option value="featured">Active Only</option>
              <option value="not-featured">Inactive Only</option>
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

        <!-- Categories table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <CategoriesTable
                  :categories="paginatedCategories"
                  :search-query="searchQuery"
                  :featured-filter="featuredFilter"
                  :sort-by="sortBy"
                  :sort-order="sortOrder"
                  :current-page="currentPage"
                  :items-per-page="itemsPerPage"
                  @toggle-sort="toggleSort"
                  @view-category="viewCategory"
                  @edit-category="editCategory"
                  @delete-category="handleDeleteCategory"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <Pagination
        :current-page="currentPage"
        :total-items="filteredCategories.length"
        :items-per-page="itemsPerPage"
        @prev="handlePrevPage"
        @next="handleNextPage"
        @page="handlePageChange"
      />
    </div>

    <!-- Add Category Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Category</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="category-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="category-name"
                        v-model="newCategory.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="category-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="category-description"
                        v-model="newCategory.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      ></textarea>
                    </div>
                  </div>
                  <div>
                    <label for="category-image" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Image</label>
                    <div class="mt-2">
                      <div class="flex items-center gap-3">
                        <input
                          type="text"
                          id="category-image"
                          v-model="newCategory.image_url"
                          placeholder="/images/categories/your-category.jpg"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                        <span class="text-gray-500 dark:text-gray-400">or</span>
                        <label for="file-upload" class="cursor-pointer rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                          Browse
                          <input
                            id="file-upload"
                            type="file"
                            accept="image/*"
                            class="sr-only"
                            @change="handleImageUpload"
                          />
                        </label>
                      </div>
                    </div>
                    <div class="mt-2 flex justify-center">
                      <template v-if="newCategory.image_url">
                        <img
                          :src="imagePreview"
                          alt="Category preview"
                          class="h-16 w-16 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                          onerror="this.src='/images/categories/placeholder.jpg'"
                        />
                      </template>
                      <template v-else>
                        <div
                          class="h-16 w-16 rounded-full flex items-center justify-center text-white font-medium shadow-sm bg-blue-500"
                        >
                          {{ newCategory.name ? newCategory.name.charAt(0).toUpperCase() : '?' }}
                        </div>
                      </template>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">Enter the URL of the category image or upload a file</p>
                  </div>
                  <div>
                    <label for="category-display-order" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Display Order</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="category-display-order"
                        v-model="newCategory.display_order"
                        min="0"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      id="category-featured"
                      type="checkbox"
                      v-model="newCategory.is_active"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                    />
                    <label for="category-featured" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">Active category</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addCategory"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add
            </button>
            <button
              type="button"
              @click="closeAddModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
