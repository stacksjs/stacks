<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Food Vendors',
})

// Sample manufacturers data
const manufacturers = ref([
  {
    id: 1,
    name: 'Pizza Palace',
    slug: 'pizza-palace',
    description: 'Authentic Italian pizzeria with handcrafted pizzas and fresh ingredients',
    productCount: 24,
    featured: true,
    country: 'United States',
    website: 'https://pizzapalace.foodmarket.org',
    createdAt: '2023-05-10'
  },
  {
    id: 2,
    name: 'Burger Bistro',
    slug: 'burger-bistro',
    description: 'Gourmet burgers made with locally sourced ingredients',
    productCount: 18,
    featured: true,
    country: 'United States',
    website: 'https://burgerbistro.foodmarket.org',
    createdAt: '2023-05-15'
  },
  {
    id: 3,
    name: 'Sushi Supreme',
    slug: 'sushi-supreme',
    description: 'Premium sushi and Japanese cuisine prepared by master chefs',
    productCount: 32,
    featured: true,
    country: 'United States',
    website: 'https://sushisupreme.foodmarket.org',
    createdAt: '2023-06-01'
  },
  {
    id: 4,
    name: 'Taco Tiempo',
    slug: 'taco-tiempo',
    description: 'Authentic Mexican street food with fresh, bold flavors',
    productCount: 22,
    featured: false,
    country: 'United States',
    website: 'https://tacotime.foodmarket.org',
    createdAt: '2023-06-10'
  },
  {
    id: 5,
    name: 'Pasta Paradise',
    slug: 'pasta-paradise',
    description: 'Handmade pasta and traditional Italian recipes',
    productCount: 16,
    featured: false,
    country: 'United States',
    website: 'https://pastaparadise.foodmarket.org',
    createdAt: '2023-06-20'
  },
  {
    id: 6,
    name: 'Healthy Harvest',
    slug: 'healthy-harvest',
    description: 'Nutritious, plant-based meals for health-conscious customers',
    productCount: 28,
    featured: true,
    country: 'United States',
    website: 'https://healthyharvest.foodmarket.org',
    createdAt: '2023-07-05'
  },
  {
    id: 7,
    name: 'Sweet Sensations',
    slug: 'sweet-sensations',
    description: 'Artisanal desserts, cakes, and pastries for every occasion',
    productCount: 35,
    featured: false,
    country: 'United States',
    website: 'https://sweetsensations.foodmarket.org',
    createdAt: '2023-07-15'
  },
  {
    id: 8,
    name: 'Beverage Boutique',
    slug: 'beverage-boutique',
    description: 'Specialty coffees, teas, smoothies, and craft beverages',
    productCount: 19,
    featured: false,
    country: 'United States',
    website: 'https://beverageboutique.foodmarket.org',
    createdAt: '2023-08-01'
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const featuredFilter = ref('all')
const countryFilter = ref('all')

// Get unique countries for filter
const countries = computed(() => {
  const uniqueCountries = new Set(manufacturers.value.map(m => m.country))
  return Array.from(uniqueCountries).sort()
})

// Computed filtered and sorted manufacturers
const filteredManufacturers = computed(() => {
  return manufacturers.value
    .filter(manufacturer => {
      // Apply search filter
      const matchesSearch = manufacturer.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           manufacturer.description.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply featured filter
      const matchesFeatured = featuredFilter.value === 'all' ||
                             (featuredFilter.value === 'featured' && manufacturer.featured) ||
                             (featuredFilter.value === 'not-featured' && !manufacturer.featured)

      // Apply country filter
      const matchesCountry = countryFilter.value === 'all' ||
                            manufacturer.country === countryFilter.value

      return matchesSearch && matchesFeatured && matchesCountry
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'productCount') {
        comparison = a.productCount - b.productCount
      } else if (sortBy.value === 'country') {
        comparison = a.country.localeCompare(b.country)
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
const newManufacturer = ref<{
  name: string;
  description: string;
  featured: boolean;
  country: string;
  website: string;
}>({
  name: '',
  description: '',
  featured: false,
  country: '',
  website: ''
})

function openAddModal(): void {
  newManufacturer.value = {
    name: '',
    description: '',
    featured: false,
    country: '',
    website: ''
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addManufacturer(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...manufacturers.value.map(m => m.id)) + 1
  const name = newManufacturer.value.name || '';
  const currentDate = new Date().toISOString().split('T')[0] as string;

  manufacturers.value.push({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: newManufacturer.value.description || '',
    productCount: 0,
    featured: newManufacturer.value.featured,
    country: newManufacturer.value.country || '',
    website: newManufacturer.value.website || '',
    createdAt: currentDate
  })
  closeAddModal()
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Manufacturers</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your product manufacturers
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add manufacturer
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
              placeholder="Search manufacturers..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="featuredFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Manufacturers</option>
              <option value="featured">Featured Only</option>
              <option value="not-featured">Not Featured</option>
            </select>

            <select
              v-model="countryFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Countries</option>
              <option v-for="country in countries" :key="country" :value="country">{{ country }}</option>
            </select>
          </div>
        </div>

        <!-- Manufacturers table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Manufacturer
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'name'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Description</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('country')" class="group inline-flex items-center">
                          Country
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'country'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('productCount')" class="group inline-flex items-center">
                          Products
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'productCount'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
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
                    <tr v-for="manufacturer in filteredManufacturers" :key="manufacturer.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ manufacturer.name }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ manufacturer.description }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ manufacturer.country }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ manufacturer.productCount }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div v-if="manufacturer.featured" class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500"></div>
                        <div v-else class="i-hugeicons-cancel-circle h-5 w-5 text-gray-400"></div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                        {{ manufacturer.createdAt }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredManufacturers.length === 0">
                      <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No manufacturers found matching your criteria
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

    <!-- Add Manufacturer Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Manufacturer</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="manufacturer-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="manufacturer-name"
                        v-model="newManufacturer.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="manufacturer-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="manufacturer-description"
                        v-model="newManufacturer.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      ></textarea>
                    </div>
                  </div>
                  <div>
                    <label for="manufacturer-country" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Country</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="manufacturer-country"
                        v-model="newManufacturer.country"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="manufacturer-website" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Website</label>
                    <div class="mt-2">
                      <input
                        type="url"
                        id="manufacturer-website"
                        v-model="newManufacturer.website"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      id="manufacturer-featured"
                      type="checkbox"
                      v-model="newManufacturer.featured"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                    />
                    <label for="manufacturer-featured" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">Featured manufacturer</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addManufacturer"
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
