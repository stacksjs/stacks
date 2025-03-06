<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'

useHead({
  title: 'Dashboard - Commerce Products',
})

// Define product type
interface Product {
  id: number
  name: string
  description: string
  price: number
  salePrice: number | null
  category: string
  manufacturer: string
  tags: string[]
  imageUrl: string
  inventory: number
  status: string
  featured: boolean
  rating: number
  reviewCount: number
  dateAdded: string
}

// Define category type
interface Category {
  id: number
  name: string
  slug: string
  count: number
}

// Sample products data (DoorDash-like food products)
const products = ref<Product[]>([
  {
    id: 1,
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese, lettuce, tomato, and special sauce on a brioche bun',
    price: 12.99,
    salePrice: null,
    category: 'Burgers',
    manufacturer: 'Burger Joint',
    tags: ['beef', 'cheese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 100,
    status: 'Active',
    featured: true,
    rating: 4.8,
    reviewCount: 243,
    dateAdded: '2023-10-15'
  },
  {
    id: 2,
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato sauce, fresh mozzarella, basil, and olive oil on a thin crust',
    price: 14.99,
    salePrice: 12.99,
    category: 'Pizza',
    manufacturer: 'Pizza Palace',
    tags: ['vegetarian', 'italian', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 80,
    status: 'Active',
    featured: true,
    rating: 4.7,
    reviewCount: 189,
    dateAdded: '2023-10-20'
  },
  {
    id: 3,
    name: 'Chicken Caesar Salad',
    description: 'Crisp romaine lettuce with grilled chicken, parmesan cheese, croutons, and Caesar dressing',
    price: 11.99,
    salePrice: null,
    category: 'Salads',
    manufacturer: 'Fresh Greens',
    tags: ['chicken', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 50,
    status: 'Active',
    featured: false,
    rating: 4.5,
    reviewCount: 124,
    dateAdded: '2023-11-05'
  },
  {
    id: 4,
    name: 'Spicy Ramen Bowl',
    description: 'Authentic Japanese ramen with spicy broth, sliced pork, soft-boiled egg, and fresh vegetables',
    price: 15.99,
    salePrice: null,
    category: 'Asian',
    manufacturer: 'Noodle House',
    tags: ['spicy', 'japanese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 60,
    status: 'Active',
    featured: true,
    rating: 4.9,
    reviewCount: 201,
    dateAdded: '2023-11-10'
  },
  {
    id: 5,
    name: 'Veggie Wrap',
    description: 'Fresh vegetables, hummus, and feta cheese wrapped in a spinach tortilla',
    price: 9.99,
    salePrice: 8.49,
    category: 'Wraps',
    manufacturer: 'Wrap Masters',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 40,
    status: 'Active',
    featured: false,
    rating: 4.4,
    reviewCount: 98,
    dateAdded: '2023-11-15'
  },
  {
    id: 6,
    name: 'BBQ Pulled Pork Sandwich',
    description: 'Slow-cooked pulled pork with BBQ sauce, coleslaw, and pickles on a brioche bun',
    price: 13.99,
    salePrice: null,
    category: 'Sandwiches',
    manufacturer: 'Smokey BBQ',
    tags: ['pork', 'bbq'],
    imageUrl: 'https://images.unsplash.com/photo-1513185041617-8ab03f83d6c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 35,
    status: 'Active',
    featured: false,
    rating: 4.6,
    reviewCount: 156,
    dateAdded: '2023-11-20'
  },
  {
    id: 7,
    name: 'Chocolate Brownie Sundae',
    description: 'Warm chocolate brownie topped with vanilla ice cream, chocolate sauce, and whipped cream',
    price: 8.99,
    salePrice: null,
    category: 'Desserts',
    manufacturer: 'Sweet Treats',
    tags: ['chocolate', 'sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 45,
    status: 'Active',
    featured: true,
    rating: 4.9,
    reviewCount: 178,
    dateAdded: '2023-11-25'
  },
  {
    id: 8,
    name: 'Iced Caramel Macchiato',
    description: 'Espresso with vanilla syrup, milk, and caramel drizzle over ice',
    price: 5.99,
    salePrice: null,
    category: 'Beverages',
    manufacturer: 'Coffee Co.',
    tags: ['coffee', 'cold'],
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 120,
    status: 'Active',
    featured: false,
    rating: 4.7,
    reviewCount: 143,
    dateAdded: '2023-12-01'
  },
  {
    id: 9,
    name: 'Chicken Wings (12 pc)',
    description: 'Crispy chicken wings with your choice of sauce: Buffalo, BBQ, or Honey Garlic',
    price: 16.99,
    salePrice: 14.99,
    category: 'Appetizers',
    manufacturer: 'Wing World',
    tags: ['chicken', 'spicy', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 70,
    status: 'Active',
    featured: true,
    rating: 4.8,
    reviewCount: 215,
    dateAdded: '2023-12-05'
  },
  {
    id: 10,
    name: 'Vegetable Stir Fry',
    description: 'Fresh vegetables stir-fried with tofu in a savory sauce, served with steamed rice',
    price: 13.49,
    salePrice: null,
    category: 'Asian',
    manufacturer: 'Wok & Roll',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 30,
    status: 'Active',
    featured: false,
    rating: 4.5,
    reviewCount: 87,
    dateAdded: '2023-12-10'
  },
  {
    id: 11,
    name: 'Beef Tacos (3 pc)',
    description: 'Soft corn tortillas filled with seasoned beef, lettuce, cheese, and pico de gallo',
    price: 10.99,
    salePrice: null,
    category: 'Mexican',
    manufacturer: 'Taco Time',
    tags: ['beef', 'spicy'],
    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 55,
    status: 'Active',
    featured: false,
    rating: 4.6,
    reviewCount: 132,
    dateAdded: '2023-12-15'
  },
  {
    id: 12,
    name: 'Strawberry Cheesecake',
    description: 'Creamy New York-style cheesecake topped with fresh strawberry sauce',
    price: 7.99,
    salePrice: null,
    category: 'Desserts',
    manufacturer: 'Sweet Treats',
    tags: ['sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 25,
    status: 'Low Stock',
    featured: true,
    rating: 4.9,
    reviewCount: 167,
    dateAdded: '2023-12-20'
  },
  {
    id: 13,
    name: 'Truffle Mushroom Pasta',
    description: 'Handmade fettuccine with wild mushrooms, truffle oil, and parmesan cream sauce',
    price: 18.99,
    salePrice: null,
    category: 'Pasta',
    manufacturer: 'Pasta Paradise',
    tags: ['vegetarian', 'premium', 'new'],
    imageUrl: 'https://images.unsplash.com/photo-1555072956-7758afb20e8f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 0,
    status: 'Coming Soon',
    featured: true,
    rating: 0,
    reviewCount: 0,
    dateAdded: '2024-01-15'
  },
  {
    id: 14,
    name: 'Matcha Green Tea Latte',
    description: 'Premium Japanese matcha powder whisked with steamed milk and a touch of honey',
    price: 6.49,
    salePrice: null,
    category: 'Beverages',
    manufacturer: 'Tea Time',
    tags: ['tea', 'japanese', 'new'],
    imageUrl: 'https://images.unsplash.com/photo-1536013455962-2668f3b24cdd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 0,
    status: 'Coming Soon',
    featured: false,
    rating: 0,
    reviewCount: 0,
    dateAdded: '2024-01-20'
  }
])

// Categories derived from products
const categories = computed<Category[]>(() => {
  const categoryMap = new Map<string, number>()

  products.value.forEach(product => {
    const count = categoryMap.get(product.category) || 0
    categoryMap.set(product.category, count + 1)
  })

  return Array.from(categoryMap.entries()).map(([name, count], index) => ({
    id: index + 1,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    count
  }))
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('dateAdded')
const sortOrder = ref('desc')
const categoryFilter = ref('all')
const statusFilter = ref('all')
const viewMode = useLocalStorage('products-view-mode', 'list') // Default to list view and save in localStorage

// Available statuses
const statuses = ['all', 'Active', 'Coming Soon', 'Low Stock', 'Out of Stock', 'Discontinued']

// Computed filtered and sorted products
const filteredProducts = computed(() => {
  return products.value
    .filter(product => {
      // Apply search filter
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply category filter
      const matchesCategory = categoryFilter.value === 'all' || product.category === categoryFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || product.status === statusFilter.value

      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'dateAdded') {
        comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
      } else if (sortBy.value === 'price') {
        const aPrice = a.salePrice !== null ? a.salePrice : a.price
        const bPrice = b.salePrice !== null ? b.salePrice : b.price
        comparison = aPrice - bPrice
      } else if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'rating') {
        comparison = a.rating - b.rating
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(8)
const totalPages = computed(() => Math.ceil(filteredProducts.value.length / itemsPerPage.value))

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
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
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Low Stock':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Out of Stock':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    case 'Discontinued':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'Coming Soon':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Modal state for adding/editing product
const showProductModal = ref(false)
const isEditMode = ref(false)
const currentProduct = ref<Product | null>(null)

// Computed properties for form fields to handle null currentProduct
const productName = computed({
  get: () => currentProduct.value?.name || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.name = value }
})

const productDescription = computed({
  get: () => currentProduct.value?.description || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.description = value }
})

const productPrice = computed({
  get: () => currentProduct.value?.price || 0,
  set: (value) => { if (currentProduct.value) currentProduct.value.price = value }
})

const productSalePrice = computed({
  get: () => currentProduct.value?.salePrice || null,
  set: (value) => { if (currentProduct.value) currentProduct.value.salePrice = value }
})

const productCategory = computed({
  get: () => currentProduct.value?.category || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.category = value }
})

const productManufacturer = computed({
  get: () => currentProduct.value?.manufacturer || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.manufacturer = value }
})

const productInventory = computed({
  get: () => currentProduct.value?.inventory || 0,
  set: (value) => { if (currentProduct.value) currentProduct.value.inventory = value }
})

const productStatus = computed({
  get: () => currentProduct.value?.status || 'Active',
  set: (value) => { if (currentProduct.value) currentProduct.value.status = value }
})

const productFeatured = computed({
  get: () => currentProduct.value?.featured || false,
  set: (value) => { if (currentProduct.value) currentProduct.value.featured = value }
})

const productImageUrl = computed({
  get: () => currentProduct.value?.imageUrl || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.imageUrl = value }
})

function openAddProductModal(): void {
  isEditMode.value = false
  currentProduct.value = {
    id: Math.max(...products.value.map(p => p.id)) + 1,
    name: '',
    description: '',
    price: 0,
    salePrice: null,
    category: '',
    manufacturer: '',
    tags: [],
    imageUrl: '',
    inventory: 0,
    status: 'Active',
    featured: false,
    rating: 0,
    reviewCount: 0,
    dateAdded: new Date().toISOString().split('T')[0] || ''
  }
  showProductModal.value = true
}

function openEditProductModal(product: Product): void {
  isEditMode.value = true
  currentProduct.value = { ...product }
  showProductModal.value = true
}

function closeProductModal(): void {
  showProductModal.value = false
}

function saveProduct(): void {
  if (!currentProduct.value) return

  if (isEditMode.value) {
    // Update existing product
    const index = products.value.findIndex(p => p.id === currentProduct.value!.id)
    if (index !== -1) {
      products.value[index] = { ...currentProduct.value }
    }
  } else {
    // Add new product
    products.value.push({ ...currentProduct.value })
  }

  closeProductModal()
}

// Calculate total products and featured products
const totalProducts = computed(() => products.value.length)
const featuredProducts = computed(() => products.value.filter(p => p.featured).length)
const lowStockProducts = computed(() => products.value.filter(p => p.status === 'Low Stock').length)
const comingSoonProducts = computed(() => products.value.filter(p => p.status === 'Coming Soon').length)

// Function to delete a product
function deleteProduct(productId: number): void {
  if (confirm('Are you sure you want to delete this product?')) {
    const index = products.value.findIndex(p => p.id === productId)
    if (index !== -1) {
      products.value.splice(index, 1)
    }
  }
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Products</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your product catalog
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddProductModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add product
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total products card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-package h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Products</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalProducts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Featured products card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-yellow-100 p-2 dark:bg-yellow-900">
                    <div class="i-hugeicons-star h-6 w-6 text-yellow-600 dark:text-yellow-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Featured Products</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ featuredProducts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Low stock products card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-red-100 p-2 dark:bg-red-900">
                    <div class="i-hugeicons-alert-01 h-6 w-6 text-red-600 dark:text-red-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock Products</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ lowStockProducts }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Coming Soon products card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-calendar-01 h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Coming Soon</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ comingSoonProducts }}</div>
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
              placeholder="Search products..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Category filter -->
            <select
              v-model="categoryFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Categories</option>
              <option v-for="category in categories" :key="category.id" :value="category.name">
                {{ category.name }} ({{ category.count }})
              </option>
            </select>

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

            <!-- View mode toggle -->
            <div class="flex rounded-md shadow-sm">
              <button
                type="button"
                @click="viewMode = 'grid'"
                :class="[
                  'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-grid h-5 w-5"></div>
              </button>
              <button
                type="button"
                @click="viewMode = 'list'"
                :class="[
                  'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-right-to-left-list-number h-5 w-5"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Sort options -->
        <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span class="mr-2">Sort by:</span>
          <button
            @click="toggleSort('name')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'name' }"
          >
            Name
            <span v-if="sortBy === 'name'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('price')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'price' }"
          >
            Price
            <span v-if="sortBy === 'price'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('rating')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'rating' }"
          >
            Rating
            <span v-if="sortBy === 'rating'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('dateAdded')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'dateAdded' }"
          >
            Date Added
            <span v-if="sortBy === 'dateAdded'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Grid view -->
        <div v-if="viewMode === 'grid'" class="mt-6">
          <div v-if="paginatedProducts.length === 0" class="py-12 text-center">
            <div class="i-hugeicons-box-01 mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No products found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter to find what you're looking for.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <!-- Product card -->
            <div
              v-for="product in paginatedProducts"
              :key="product.id"
              class="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-blue-gray-800"
              :class="{ 'ring-2 ring-purple-500 dark:ring-purple-400': product.status === 'Coming Soon' }"
            >
              <!-- Product image with status badge -->
              <div class="relative aspect-square overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  :src="product.imageUrl"
                  :alt="product.name"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  :class="{ 'opacity-80': product.status === 'Coming Soon' }"
                />
                <span
                  v-if="product.status !== 'Active'"
                  :class="[getStatusClass(product.status), 'absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium']"
                >
                  {{ product.status }}
                </span>
                <span
                  v-if="product.featured"
                  class="absolute top-2 left-2 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400"
                >
                  Featured
                </span>
                <div v-if="product.status === 'Coming Soon'" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <span class="transform rotate-12 bg-purple-600 text-white px-6 py-2 text-lg font-bold shadow-lg">Coming Soon</span>
                </div>
              </div>

              <!-- Product info -->
              <div class="p-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</h3>
                  <div class="flex items-center">
                    <div class="i-hugeicons-star h-4 w-4 text-yellow-400"></div>
                    <span class="ml-1 text-sm text-gray-600 dark:text-gray-400">{{ product.rating }}</span>
                    <span class="ml-1 text-xs text-gray-500 dark:text-gray-500">({{ product.reviewCount }})</span>
                  </div>
                </div>

                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ product.description }}</p>

                <div class="mt-2">
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ product.category }}</span>
                </div>

                <div class="mt-2 flex items-center">
                  <span v-if="product.salePrice !== null" class="text-sm font-medium text-gray-900 dark:text-white">${{ product.salePrice.toFixed(2) }}</span>
                  <span
                    :class="[product.salePrice !== null ? 'line-through ml-2 text-sm text-gray-500 dark:text-gray-400' : 'text-sm font-medium text-gray-900 dark:text-white']"
                  >
                    ${{ product.price.toFixed(2) }}
                  </span>
                </div>

                <div class="mt-3 flex items-center justify-between">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ product.inventory }} in stock
                  </span>
                  <div class="flex space-x-2">
                    <button
                      @click="openEditProductModal(product)"
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <div class="i-hugeicons-edit-01 h-4 w-4"></div>
                      <span class="sr-only">Edit {{ product.name }}</span>
                    </button>
                    <button
                      @click="deleteProduct(product.id)"
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <div class="i-hugeicons-waste h-4 w-4"></div>
                      <span class="sr-only">Delete {{ product.name }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List view -->
        <div v-if="viewMode === 'list'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Product</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Manufacturer</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Category</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Price</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Inventory</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Created At</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedProducts.length === 0">
                <td colspan="8" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No products found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="product in paginatedProducts" :key="product.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img :src="product.imageUrl" :alt="product.name" class="h-10 w-10 rounded-md object-cover" />
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ product.name }}</div>
                      <div class="flex items-center mt-1">
                        <div class="i-hugeicons-star h-3 w-3 text-yellow-400"></div>
                        <span class="ml-1 text-xs text-gray-500 dark:text-gray-400">{{ product.rating }} ({{ product.reviewCount }})</span>
                        <span v-if="product.featured" class="ml-2 inline-flex items-center rounded-full bg-yellow-50 px-1.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Featured
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ product.manufacturer }}</td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ product.category }}</td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div v-if="product.salePrice !== null">
                    <div class="font-medium text-gray-900 dark:text-white">${{ product.salePrice.toFixed(2) }}</div>
                    <div class="line-through text-xs text-gray-500 dark:text-gray-400">${{ product.price.toFixed(2) }}</div>
                  </div>
                  <div v-else class="font-medium text-gray-900 dark:text-white">${{ product.price.toFixed(2) }}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(product.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
                    {{ product.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ product.inventory }}</td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ product.dateAdded }}</td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      @click="openEditProductModal(product)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit {{ product.name }}</span>
                    </button>
                    <button
                      @click="deleteProduct(product.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete {{ product.name }}</span>
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
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredProducts.length) }}</span> of
                <span class="font-medium">{{ filteredProducts.length }}</span> results
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

    <!-- Add/Edit Product Modal -->
    <div v-if="showProductModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closeProductModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-can h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {{ isEditMode ? 'Edit Product' : 'Add New Product' }}
              </h3>
              <div class="mt-4">
                <form @submit.prevent="saveProduct" class="space-y-4">
                  <!-- Product name -->
                  <div>
                    <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="product-name"
                      v-model="productName"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- Product description -->
                  <div>
                    <label for="product-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      id="product-description"
                      v-model="productDescription"
                      rows="3"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    ></textarea>
                  </div>

                  <!-- Price and sale price -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price ($)</label>
                      <input
                        type="number"
                        id="product-price"
                        v-model="productPrice"
                        min="0"
                        step="0.01"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-sale-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Price ($)</label>
                      <input
                        type="number"
                        id="product-sale-price"
                        v-model="productSalePrice"
                        min="0"
                        step="0.01"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <!-- Category and manufacturer -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                      <input
                        type="text"
                        id="product-category"
                        v-model="productCategory"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                      <input
                        type="text"
                        id="product-manufacturer"
                        v-model="productManufacturer"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <!-- Inventory and status -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-inventory" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inventory</label>
                      <input
                        type="number"
                        id="product-inventory"
                        v-model="productInventory"
                        min="0"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select
                        id="product-status"
                        v-model="productStatus"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option v-for="status in statuses.slice(1)" :key="status" :value="status">{{ status }}</option>
                      </select>
                    </div>
                  </div>

                  <!-- Featured checkbox -->
                  <div class="mt-4">
                    <div class="flex items-center">
                      <input
                        id="product-featured"
                        type="checkbox"
                        v-model="productFeatured"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                      <label for="product-featured" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Featured product</label>
                    </div>
                  </div>

                  <!-- Image URL -->
                  <div>
                    <label for="product-image" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                    <input
                      type="text"
                      id="product-image"
                      v-model="productImageUrl"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      {{ isEditMode ? 'Save Changes' : 'Add Product' }}
                    </button>
                    <button
                      type="button"
                      @click="closeProductModal"
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
