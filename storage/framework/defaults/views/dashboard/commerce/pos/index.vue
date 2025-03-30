<script lang="ts" setup>
import { ref, computed, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'

useHead({
  title: 'Restaurant POS - Table Ordering',
})

// Define menu item type
interface MenuItem {
  id: number
  name: string
  description: string
  price: number
  salePrice: number | null
  category: string
  tags: string[]
  imageUrl: string
  available: boolean
  featured: boolean
  rating: number
  reviewCount: number
  preparationTime: string
  allergies: string[]
}

// Define category type
interface Category {
  id: number
  name: string
  slug: string
  count: number
}

// Define order type
interface OrderItem {
  menuItemId: number
  name: string
  price: number
  quantity: number
  specialInstructions: string
  modifiers: string[]
}

interface Order {
  id: number
  tableNumber: number
  items: OrderItem[]
  status: 'new' | 'in-progress' | 'ready' | 'served' | 'paid'
  createdAt: string
  totalAmount: number
}

// Sample menu items data
const menuItems = ref<MenuItem[]>([
  {
    id: 1,
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese, lettuce, tomato, and special sauce on a brioche bun',
    price: 12.99,
    salePrice: null,
    category: 'Burgers',
    tags: ['beef', 'cheese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.8,
    reviewCount: 243,
    preparationTime: '15 min',
    allergies: ['dairy']
  },
  {
    id: 2,
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato sauce, fresh mozzarella, basil, and olive oil on a thin crust',
    price: 14.99,
    salePrice: 12.99,
    category: 'Pizza',
    tags: ['vegetarian', 'italian', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.7,
    reviewCount: 189,
    preparationTime: '20 min',
    allergies: ['gluten', 'dairy']
  },
  {
    id: 3,
    name: 'Chicken Caesar Salad',
    description: 'Crisp romaine lettuce with grilled chicken, parmesan cheese, croutons, and Caesar dressing',
    price: 11.99,
    salePrice: null,
    category: 'Salads',
    tags: ['chicken', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.5,
    reviewCount: 124,
    preparationTime: '10 min',
    allergies: ['dairy', 'egg']
  },
  {
    id: 4,
    name: 'Spicy Ramen Bowl',
    description: 'Authentic Japanese ramen with spicy broth, sliced pork, soft-boiled egg, and fresh vegetables',
    price: 15.99,
    salePrice: null,
    category: 'Asian',
    tags: ['spicy', 'japanese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.9,
    reviewCount: 201,
    preparationTime: '15 min',
    allergies: ['egg', 'soy', 'gluten']
  },
  {
    id: 5,
    name: 'Veggie Wrap',
    description: 'Fresh vegetables, hummus, and feta cheese wrapped in a spinach tortilla',
    price: 9.99,
    salePrice: 8.49,
    category: 'Wraps',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.4,
    reviewCount: 98,
    preparationTime: '5 min',
    allergies: ['dairy', 'gluten']
  },
  {
    id: 6,
    name: 'BBQ Pulled Pork Sandwich',
    description: 'Slow-cooked pulled pork with BBQ sauce, coleslaw, and pickles on a brioche bun',
    price: 13.99,
    salePrice: null,
    category: 'Sandwiches',
    tags: ['pork', 'bbq'],
    imageUrl: 'https://images.unsplash.com/photo-1513185041617-8ab03f83d6c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.6,
    reviewCount: 156,
    preparationTime: '12 min',
    allergies: ['gluten']
  },
  {
    id: 7,
    name: 'Chocolate Brownie Sundae',
    description: 'Warm chocolate brownie topped with vanilla ice cream, chocolate sauce, and whipped cream',
    price: 8.99,
    salePrice: null,
    category: 'Desserts',
    tags: ['chocolate', 'sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.9,
    reviewCount: 178,
    preparationTime: '8 min',
    allergies: ['dairy', 'egg', 'gluten']
  },
  {
    id: 8,
    name: 'Iced Caramel Macchiato',
    description: 'Espresso with vanilla syrup, milk, and caramel drizzle over ice',
    price: 5.99,
    salePrice: null,
    category: 'Beverages',
    tags: ['coffee', 'cold'],
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.7,
    reviewCount: 143,
    preparationTime: '3 min',
    allergies: ['dairy']
  },
  {
    id: 9,
    name: 'Chicken Wings (12 pc)',
    description: 'Crispy chicken wings with your choice of sauce: Buffalo, BBQ, or Honey Garlic',
    price: 16.99,
    salePrice: 14.99,
    category: 'Appetizers',
    tags: ['chicken', 'spicy', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.8,
    reviewCount: 215,
    preparationTime: '18 min',
    allergies: []
  },
  {
    id: 10,
    name: 'Vegetable Stir Fry',
    description: 'Fresh vegetables stir-fried with tofu in a savory sauce, served with steamed rice',
    price: 13.49,
    salePrice: null,
    category: 'Asian',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.5,
    reviewCount: 87,
    preparationTime: '15 min',
    allergies: ['soy']
  },
  {
    id: 11,
    name: 'Beef Tacos (3 pc)',
    description: 'Soft corn tortillas filled with seasoned beef, lettuce, cheese, and pico de gallo',
    price: 10.99,
    salePrice: null,
    category: 'Mexican',
    tags: ['beef', 'spicy'],
    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: false,
    rating: 4.6,
    reviewCount: 132,
    preparationTime: '10 min',
    allergies: ['dairy']
  },
  {
    id: 12,
    name: 'Strawberry Cheesecake',
    description: 'Creamy New York-style cheesecake topped with fresh strawberry sauce',
    price: 7.99,
    salePrice: null,
    category: 'Desserts',
    tags: ['sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    available: true,
    featured: true,
    rating: 4.9,
    reviewCount: 167,
    preparationTime: '0 min',
    allergies: ['dairy', 'gluten']
  }
])

// Categories derived from menu items
const categories = computed<Category[]>(() => {
  const categoryMap = new Map<string, number>()

  menuItems.value.forEach(item => {
    const count = categoryMap.get(item.category) || 0
    categoryMap.set(item.category, count + 1)
  })

  return Array.from(categoryMap.entries()).map(([name, count], index) => ({
    id: index + 1,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    count
  }))
})

// Current table number
const tableNumber = ref(1)
const availableTables = Array.from({ length: 20 }, (_, i) => i + 1)

// Filter and sort options
const searchQuery = ref('')
const categoryFilter = ref('all')
const viewMode = useLocalStorage('menu-view-mode', 'grid') // Default to grid view for better imagery

// Computed filtered and sorted menu items
const filteredMenuItems = computed(() => {
  return menuItems.value
    .filter(item => {
      // Apply search filter
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply category filter
      const matchesCategory = categoryFilter.value === 'all' || item.category === categoryFilter.value

      return matchesSearch && matchesCategory
    })
})

// Current order
const currentOrder = reactive<Order>({
  id: 1,
  tableNumber: 1,
  items: [],
  status: 'new',
  createdAt: new Date().toISOString(),
  totalAmount: 0
})

// Add item to order
function addToOrder(menuItem: MenuItem, quantity = 1): void {
  const existingItem = currentOrder.items.find(item => item.menuItemId === menuItem.id)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    currentOrder.items.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.salePrice !== null ? menuItem.salePrice : menuItem.price,
      quantity,
      specialInstructions: '',
      modifiers: []
    })
  }

  updateOrderTotal()
}

// Remove item from order
function removeFromOrder(index: number): void {
  currentOrder.items.splice(index, 1)
  updateOrderTotal()
}

// Update item quantity
function updateItemQuantity(index: number, quantity: number): void {
  if (quantity <= 0) {
    removeFromOrder(index)
    return
  }

  currentOrder.items[index].quantity = quantity
  updateOrderTotal()
}

// Update order total
function updateOrderTotal(): void {
  currentOrder.totalAmount = currentOrder.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
}

// Special instructions modal
const showSpecialInstructionsModal = ref(false)
const currentEditingItemIndex = ref(-1)
const tempSpecialInstructions = ref('')

function openSpecialInstructionsModal(index: number): void {
  currentEditingItemIndex.value = index
  tempSpecialInstructions.value = currentOrder.items[index].specialInstructions
  showSpecialInstructionsModal.value = true
}

function saveSpecialInstructions(): void {
  if (currentEditingItemIndex.value >= 0) {
    currentOrder.items[currentEditingItemIndex.value].specialInstructions = tempSpecialInstructions.value
  }
  showSpecialInstructionsModal.value = false
}

// Place order functionality
const orderPlaced = ref(false)
const orderSummary = ref<Order | null>(null)

function placeOrder(): void {
  if (currentOrder.items.length === 0) {
    alert('Please add items to your order')
    return
  }

  // Update order status
  currentOrder.tableNumber = tableNumber.value
  currentOrder.status = 'new'
  currentOrder.createdAt = new Date().toISOString()

  // Save a copy of the current order for summary display
  orderSummary.value = JSON.parse(JSON.stringify(currentOrder)) as Order

  // Show order confirmation
  orderPlaced.value = true

  // Reset order for a new one
  setTimeout(() => {
    currentOrder.items = []
    currentOrder.totalAmount = 0
    currentOrder.id++
    orderPlaced.value = false
    orderSummary.value = null
  }, 10000) // Reset after 10 seconds
}

// Table selection
function selectTable(table: number): void {
  tableNumber.value = table
}

// Get allergy tag class
function getAllergyClass(allergy: string): string {
  switch (allergy) {
    case 'dairy':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'gluten':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'egg':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'soy':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    case 'nuts':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
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
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Restaurant Menu</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Table {{ tableNumber }} - Order your meal directly from your table
            </p>
          </div>
          <div class="mt-4 sm:mt-0 flex items-center gap-4">
            <!-- Table selection dropdown -->
            <div>
              <label for="table-select" class="sr-only">Select Table</label>
              <select
                id="table-select"
                v-model="tableNumber"
                @change="selectTable(tableNumber)"
                class="block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option v-for="table in availableTables" :key="table" :value="table">
                  Table {{ table }}
                </option>
              </select>
            </div>

            <!-- View cart button -->
            <button
              type="button"
              class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-shopping-cart h-5 w-5 mr-1"></div>
              View Order
              <span
                v-if="currentOrder.items.length > 0"
                class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
              >
                {{ currentOrder.items.length }}
              </span>
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
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ menuItems.length }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Table selection card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-yellow-100 p-2 dark:bg-yellow-900">
                    <div class="i-hugeicons-table h-6 w-6 text-yellow-600 dark:text-yellow-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Table</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ tableNumber }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Category navigation -->
        <div class="mt-6 overflow-x-auto pb-2">
          <div class="inline-flex space-x-2">
            <button
              @click="categoryFilter = 'all'"
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="categoryFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-blue-gray-700 dark:text-white dark:hover:bg-blue-gray-600'"
            >
              All
            </button>
            <button
              v-for="category in categories"
              :key="category.id"
              @click="categoryFilter = category.name"
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="categoryFilter === category.name
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-blue-gray-700 dark:text-white dark:hover:bg-blue-gray-600'"
            >
              {{ category.name }}
            </button>
          </div>
        </div>

        <!-- Search bar -->
        <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search menu..."
            />
          </div>

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
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
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
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
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
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
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
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Menu items grid view -->
        <div v-if="viewMode === 'grid'" class="mt-6">
          <div v-if="filteredMenuItems.length === 0" class="py-12 text-center">
            <div class="i-hugeicons-box-01 mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No menu items found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or category filter.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            <!-- Menu item card -->
            <div
              v-for="item in filteredMenuItems"
              :key="item.id"
              class="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-blue-gray-800"
              :class="{ 'opacity-70': !item.available }"
            >
              <!-- Item image with badges -->
              <div class="relative aspect-square overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  :src="item.imageUrl"
                  :alt="item.name"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span
                  v-if="!item.available"
                  class="absolute top-2 right-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400"
                >
                  Unavailable
                </span>
                <span
                  v-if="item.featured"
                  class="absolute top-2 left-2 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400"
                >
                  Popular
                </span>
              </div>

              <!-- Item info -->
              <div class="p-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-gray-900 dark:text-white">{{ item.name }}</h3>
                  <div class="flex items-center">
                    <div class="i-hugeicons-star h-4 w-4 text-yellow-400"></div>
                    <span class="ml-1 text-sm text-gray-600 dark:text-gray-400">{{ item.rating }}</span>
                  </div>
                </div>

                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ item.description }}</p>

                <div class="mt-2 flex flex-wrap gap-1">
                  <span
                    v-for="allergy in item.allergies"
                    :key="allergy"
                    :class="getAllergyClass(allergy)"
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    {{ allergy }}
                  </span>
                </div>

                <div class="mt-2 flex items-center justify-between">
                  <div>
                    <span v-if="item.salePrice !== null" class="text-sm font-medium text-gray-900 dark:text-white">${{ item.salePrice.toFixed(2) }}</span>
                    <span
                      :class="[item.salePrice !== null ? 'line-through ml-2 text-sm text-gray-500 dark:text-gray-400' : 'text-sm font-medium text-gray-900 dark:text-white']"
                    >
                      ${{ item.price.toFixed(2) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ item.preparationTime }}
                  </span>
                </div>

                <button
                  @click="addToOrder(item)"
                  :disabled="!item.available"
                  class="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Menu items list view -->
        <div v-if="viewMode === 'list'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Item</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Category</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Price</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Prep Time</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="filteredMenuItems.length === 0">
                <td colspan="5" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No menu items found. Try adjusting your search or category filter.
                </td>
              </tr>
              <tr v-for="item in filteredMenuItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700" :class="{ 'opacity-70': !item.available }">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img :src="item.imageUrl" :alt="item.name" class="h-10 w-10 rounded-md object-cover" />
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ item.name }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs line-clamp-1">{{ item.description }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ item.category }}</td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div v-if="item.salePrice !== null">
                    <div class="font-medium text-gray-900 dark:text-white">${{ item.salePrice.toFixed(2) }}</div>
                    <div class="line-through text-xs text-gray-500 dark:text-gray-400">${{ item.price.toFixed(2) }}</div>
                  </div>
                  <div v-else class="font-medium text-gray-900 dark:text-white">${{ item.price.toFixed(2) }}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ item.preparationTime }}</td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button
                    @click="addToOrder(item)"
                    :disabled="!item.available"
                    class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
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
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredMenuItems.length) }}</span> of
                <span class="font-medium">{{ filteredMenuItems.length }}</span> results
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

        <!-- Current Order section (cart) -->
        <div class="mt-8 bg-white shadow-sm rounded-lg overflow-hidden dark:bg-blue-gray-800">
          <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Your Order (Table {{ tableNumber }})</h2>
          </div>

          <div v-if="currentOrder.items.length === 0" class="p-6 text-center">
            <div class="i-hugeicons-shopping-cart mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Your order is empty</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Add items from the menu to start your order.</p>
          </div>

          <div v-else>
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              <li v-for="(item, index) in currentOrder.items" :key="index" class="px-6 py-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <div class="flex items-center">
                      <button
                        @click="updateItemQuantity(index, item.quantity - 1)"
                        class="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                      >
                        <div class="i-hugeicons-minus h-5 w-5"></div>
                      </button>
                      <span class="mx-2 text-gray-700 dark:text-gray-300">{{ item.quantity }}</span>
                      <button
                        @click="updateItemQuantity(index, item.quantity + 1)"
                        class="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                      >
                        <div class="i-hugeicons-plus-sign h-5 w-5"></div>
                      </button>
                    </div>

                    <div class="ml-4">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.name }}</p>
                      <p v-if="item.specialInstructions" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ item.specialInstructions }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">${{ (item.price * item.quantity).toFixed(2) }}</span>
                    <div class="ml-4 flex">
                      <button
                        @click="openSpecialInstructionsModal(index)"
                        class="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                      >
                        <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      </button>
                      <button
                        @click="removeFromOrder(index)"
                        class="p-1 rounded-full text-gray-400 hover:text-red-500 focus:outline-none focus:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                      >
                        <div class="i-hugeicons-waste h-5 w-5"></div>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div class="flex justify-between text-base font-medium text-gray-900 dark:text-white">
                <p>Total</p>
                <p>${{ currentOrder.totalAmount.toFixed(2) }}</p>
              </div>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Taxes calculated at checkout</p>
              <div class="mt-4">
                <button
                  @click="placeOrder"
                  class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  Place Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Special Instructions Modal -->
    <div v-if="showSpecialInstructionsModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="showSpecialInstructionsModal = false"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-can h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Special Instructions
              </h3>
              <div class="mt-4">
                <textarea
                  v-model="tempSpecialInstructions"
                  rows="4"
                  class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                  placeholder="Any special requests for this item?"
                ></textarea>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  @click="saveSpecialInstructions"
                  class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                >
                  Save
                </button>
                <button
                  type="button"
                  @click="showSpecialInstructionsModal = false"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Confirmation Modal -->
    <div v-if="orderPlaced" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <div class="i-hugeicons-check h-6 w-6 text-green-600 dark:text-green-300"></div>
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Order Placed Successfully!
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Your order has been placed for table {{ orderSummary?.tableNumber }}. Your food will be prepared shortly.
                </p>
              </div>
              <div class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Order Summary</h4>
                <ul class="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                  <li v-for="(item, index) in orderSummary?.items || []" :key="index" class="py-2 flex justify-between">
                    <div class="text-sm text-gray-700 dark:text-gray-300">
                      {{ item.quantity }}x {{ item.name }}
                      <span v-if="item.specialInstructions" class="block text-xs text-gray-500 dark:text-gray-400">
                        {{ item.specialInstructions }}
                      </span>
                    </div>
                    <span class="text-sm text-gray-700 dark:text-gray-300">${{ (item.price * item.quantity).toFixed(2) }}</span>
                  </li>
                </ul>
                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Total</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">${{ orderSummary?.totalAmount?.toFixed(2) || '0.00' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6">
            <button
              type="button"
              @click="orderPlaced = false"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
