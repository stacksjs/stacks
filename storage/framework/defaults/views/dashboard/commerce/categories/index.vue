<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Categories',
})

// Sample categories data
const categories = ref([
  {
    id: 1,
    name: 'Pizza',
    slug: 'pizza',
    description: 'Traditional and specialty pizzas',
    productCount: 24,
    featured: true,
    createdAt: '2023-05-10',
    image: '/images/categories/pizza.jpg'
  },
  {
    id: 2,
    name: 'Burgers',
    slug: 'burgers',
    description: 'Gourmet and classic burgers',
    productCount: 18,
    featured: true,
    createdAt: '2023-05-15',
    image: ''
  },
  {
    id: 3,
    name: 'Sushi',
    slug: 'sushi',
    description: 'Fresh sushi, rolls, and Japanese cuisine',
    productCount: 32,
    featured: true,
    createdAt: '2023-06-01',
    image: '/images/categories/sushi.jpg'
  },
  {
    id: 4,
    name: 'Mexican',
    slug: 'mexican',
    description: 'Authentic Mexican dishes and street food',
    productCount: 22,
    featured: false,
    createdAt: '2023-06-10',
    image: ''
  },
  {
    id: 5,
    name: 'Pasta',
    slug: 'pasta',
    description: 'Italian pasta dishes and specialties',
    productCount: 16,
    featured: false,
    createdAt: '2023-06-20',
    image: '/images/categories/pasta.jpg'
  },
  {
    id: 6,
    name: 'Healthy',
    slug: 'healthy',
    description: 'Nutritious, plant-based, and health-conscious options',
    productCount: 28,
    featured: true,
    createdAt: '2023-07-05',
    image: '/images/categories/healthy.jpg'
  },
  {
    id: 7,
    name: 'Desserts',
    slug: 'desserts',
    description: 'Sweet treats, cakes, and pastries',
    productCount: 35,
    featured: false,
    createdAt: '2023-07-15',
    image: ''
  },
  {
    id: 8,
    name: 'Beverages',
    slug: 'beverages',
    description: 'Coffee, tea, smoothies, and specialty drinks',
    productCount: 19,
    featured: false,
    createdAt: '2023-08-01',
    image: '/images/categories/beverages.jpg'
  },
  {
    id: 9,
    name: 'Appetizers',
    slug: 'appetizers',
    description: 'Starters, small plates, and shareable items',
    productCount: 26,
    featured: true,
    createdAt: '2023-08-10',
    image: '/images/categories/appetizers.jpg'
  },
  {
    id: 10,
    name: 'Asian Fusion',
    slug: 'asian-fusion',
    description: 'Creative dishes combining Asian culinary traditions',
    productCount: 21,
    featured: false,
    createdAt: '2023-08-20',
    image: ''
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const featuredFilter = ref('all')

// Computed filtered and sorted categories
const filteredCategories = computed(() => {
  return categories.value
    .filter(category => {
      // Apply search filter
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           category.description.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply featured filter
      const matchesFeatured = featuredFilter.value === 'all' ||
                             (featuredFilter.value === 'featured' && category.featured) ||
                             (featuredFilter.value === 'not-featured' && !category.featured)

      return matchesSearch && matchesFeatured
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'productCount') {
        comparison = a.productCount - b.productCount
      } else if (sortBy.value === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

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
  featured: boolean;
  image: string;
}>({
  name: '',
  description: '',
  featured: false,
  image: ''
})

// Image preview helper
const imagePreview = computed(() => {
  return newCategory.value.image || '/images/categories/placeholder.jpg'
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
        newCategory.value.image = e.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }
}

function openAddModal(): void {
  newCategory.value = {
    name: '',
    description: '',
    featured: false,
    image: ''
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addCategory(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...categories.value.map(c => c.id)) + 1
  const currentDate = new Date().toISOString().split('T')[0] as string;

  categories.value.push({
    id,
    name: newCategory.value.name || '',
    slug: (newCategory.value.name || '').toLowerCase().replace(/\s+/g, '-'),
    description: newCategory.value.description || '',
    productCount: 0,
    featured: newCategory.value.featured,
    createdAt: currentDate,
    image: newCategory.value.image || '/images/categories/placeholder.jpg'
  })
  closeAddModal()
}

// Color mapping for initial letters
const initialColors: Record<string, string> = {
  'Burgers': 'bg-red-500',
  'Mexican': 'bg-green-500',
  'Desserts': 'bg-purple-500',
  'Asian Fusion': 'bg-blue-500'
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
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="featuredFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Categories</option>
              <option value="featured">Featured Only</option>
              <option value="not-featured">Not Featured</option>
            </select>
          </div>
        </div>

        <!-- Categories table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Category
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'name'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Description</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('productCount')" class="group inline-flex items-center">
                          Products
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'productCount'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Featured</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 text-right">
                        <button @click="toggleSort('createdAt')" class="group inline-flex items-center text-right">
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
                    <tr v-for="category in filteredCategories" :key="category.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                        <div class="flex items-center space-x-3">
                          <template v-if="category.image">
                            <img
                              :src="category.image"
                              :alt="category.name"
                              class="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                              onerror="this.src='/images/categories/placeholder.jpg'"
                            />
                          </template>
                          <template v-else>
                            <div
                              :class="['h-10 w-10 rounded-full flex items-center justify-center text-white font-medium shadow-sm',
                                initialColors[category.name] || 'bg-blue-500']"
                            >
                              {{ category.name ? category.name.charAt(0).toUpperCase() : '?' }}
                            </div>
                          </template>
                          <span>{{ category.name }}</span>
                        </div>
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ category.description }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ category.productCount }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div v-if="category.featured" class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500"></div>
                        <div v-else class="i-hugeicons-close-circle h-5 w-5 text-gray-400"></div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                        {{ category.createdAt }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredCategories.length === 0">
                      <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No categories found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
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
                          v-model="newCategory.image"
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
                      <template v-if="newCategory.image">
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
                  <div class="flex items-center">
                    <input
                      id="category-featured"
                      type="checkbox"
                      v-model="newCategory.featured"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                    />
                    <label for="category-featured" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">Featured category</label>
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
