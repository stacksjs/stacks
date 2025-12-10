<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@stacksjs/notification'
// @ts-ignore
import { Dialog, DialogPanel } from '@stacksjs/dialog'

// Define page metadata
const pageTitle = 'Product Detail'

const route = useRoute()
const router = useRouter()

// Product data structure
interface Product {
  id: number
  name: string
  price: number
  description: string
  category: string
  stock: number
  status: string
  images: string[]
  videos: string[]
  manufacturer: string
  variants: string[]
  unit: string
  taxRate: number
  specifications: Record<string, string>
  similarProducts?: number[]
}

// Sample product data - in a real app, this would be fetched from an API
const product = ref<Product | null>(null)
const loading = ref(true)
const activeImageIndex = ref(0)
const showVideoModal = ref(false)
const activeVideoUrl = ref('')

// Edit dialog state
const showEditDialog = ref(false)
const editingProduct = ref<Product | null>(null)

// Similar products dialog state
const showSimilarProductsDialog = ref(false)

// All products for similar products selection
const allProducts = ref<Product[]>([])

// Similar products to display
const similarProducts = computed(() => {
  if (!product.value || !product.value.similarProducts || !allProducts.value.length) return []

  return allProducts.value.filter(p => product.value?.similarProducts?.includes(p.id))
})

// Fetch product data
onMounted(async () => {
  // Simulate API call
  setTimeout(() => {
    // In a real app, you would fetch the product by ID from the route params
    const productId = parseInt(route.params.id as string)

    // Sample data for all products (simplified)
    allProducts.value = [
      {
        id: 1,
        name: 'Margherita Pizza',
        price: 12.99,
        description: 'Classic Italian pizza with tomato sauce, fresh mozzarella, basil, and extra virgin olive oil.',
        category: 'Pizza',
        stock: 78,
        status: 'Active',
        images: ['https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
        videos: [],
        manufacturer: 'Pizza Palace',
        variants: ['Size', 'Crust Type'],
        unit: 'Whole',
        taxRate: 7,
        specifications: {},
        similarProducts: [2, 5]
      },
      {
        id: 2,
        name: 'Classic Cheeseburger',
        price: 9.99,
        description: 'Juicy beef patty with melted cheese, lettuce, tomato, and special sauce.',
        category: 'Burgers',
        stock: 124,
        status: 'Active',
        images: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
        videos: [],
        manufacturer: 'Burger Bistro',
        variants: ['Size', 'Protein', 'Toppings'],
        unit: 'Piece',
        taxRate: 7,
        specifications: {},
        similarProducts: [1]
      },
      {
        id: 5,
        name: 'Fettuccine Alfredo',
        price: 13.99,
        description: 'Creamy pasta with parmesan cheese sauce.',
        category: 'Pasta',
        stock: 210,
        status: 'Active',
        images: ['https://images.unsplash.com/photo-1645112411341-6c4fd023882c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
        videos: [],
        manufacturer: 'Pasta Paradise',
        variants: ['Size', 'Protein'],
        unit: 'Serving',
        taxRate: 7,
        specifications: {},
        similarProducts: [1]
      }
    ]

    // Sample data
    product.value = {
      id: productId || 1,
      name: 'Margherita Pizza',
      price: 12.99,
      description: 'Classic Italian pizza with tomato sauce, fresh mozzarella, basil, and extra virgin olive oil. Made with our signature hand-tossed dough and baked in a wood-fired oven for the perfect crispy yet chewy crust.',
      category: 'Pizza',
      stock: 78,
      status: 'Active',
      images: [
        'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      ],
      videos: [
        'https://example.com/videos/margherita-pizza.mp4',
        'https://example.com/videos/pizza-preparation.mp4'
      ],
      manufacturer: 'Pizza Palace',
      variants: ['Size', 'Crust Type'],
      unit: 'Whole',
      taxRate: 7,
      specifications: {
        'Calories': '250 per slice',
        'Preparation Time': '15-20 minutes',
        'Ingredients': 'Dough, Tomato Sauce, Fresh Mozzarella, Basil, Olive Oil, Salt',
        'Allergens': 'Wheat, Dairy',
        'Dietary': 'Vegetarian',
        'Serving Size': '8 slices per pizza'
      },
      similarProducts: [2, 5]
    }
    loading.value = false
  }, 1000)
})

// Function to handle image selection
const selectImage = (index: number) => {
  activeImageIndex.value = index
}

// Function to open video modal
const openVideoModal = (videoUrl: string) => {
  activeVideoUrl.value = videoUrl
  showVideoModal.value = true
}

// Function to close video modal
const closeVideoModal = () => {
  showVideoModal.value = false
  activeVideoUrl.value = ''
}

// Function to go back to products list
const goBack = () => {
  router.push('/commerce/products')
}

// Function to edit product
const editProduct = () => {
  if (!product.value) return

  editingProduct.value = JSON.parse(JSON.stringify(product.value)) as Product
  showEditDialog.value = true
}

// Function to save edited product
function saveProduct(): void {
  if (!editingProduct.value || !product.value) return

  // Update the product
  product.value = { ...editingProduct.value }

  // Show success message
  toast({
    message: 'Product updated successfully',
    type: 'success',
  })

  // Close the dialog
  showEditDialog.value = false
}

// Function to open similar products dialog
function openSimilarProductsDialog(): void {
  if (!product.value) return

  editingProduct.value = JSON.parse(JSON.stringify(product.value)) as Product
  showSimilarProductsDialog.value = true
}

// Function to save similar products
function saveSimilarProducts(): void {
  if (!editingProduct.value || !product.value) return

  // Update only the similarProducts field
  product.value.similarProducts = editingProduct.value.similarProducts || []

  // Show success message
  toast({
    message: 'Similar products updated successfully',
    type: 'success',
  })

  // Close the dialog
  showSimilarProductsDialog.value = false
}

// Function to delete product
const deleteProduct = () => {
  toast({
    message: 'Delete functionality would be implemented here',
    type: 'error',
  })
  // After successful deletion, navigate back to products list
  // router.push('/commerce/products')
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="product" class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <!-- Header with back button and actions -->
      <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <button @click="goBack" class="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ product.name }}</h1>
        </div>
        <div class="flex space-x-2">
          <button @click="editProduct" class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors">
            Edit
          </button>
          <button @click="deleteProduct" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <!-- Product content -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        <!-- Images and videos section -->
        <div>
          <!-- Main image -->
          <div class="mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-square">
            <img :src="product.images[activeImageIndex]" :alt="product.name" class="w-full h-full object-contain">
          </div>

          <!-- Thumbnails -->
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="(image, index) in product.images"
              :key="`img-${index}`"
              @click="selectImage(index)"
              class="cursor-pointer rounded-md overflow-hidden aspect-square"
              :class="{ 'ring-2 ring-primary': activeImageIndex === index }"
            >
              <img :src="image" :alt="`${product.name} thumbnail ${index + 1}`" class="w-full h-full object-cover">
            </div>

            <!-- Video thumbnails -->
            <div
              v-for="(video, index) in product.videos"
              :key="`vid-${index}`"
              @click="openVideoModal(video)"
              class="cursor-pointer rounded-md overflow-hidden aspect-square bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Product details -->
        <div>
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">{{ product.name }}</h2>
              <span class="px-3 py-1 text-sm rounded-full" :class="{
                'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100': product.status === 'Active',
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100': product.status === 'Low Stock',
                'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100': product.status === 'Out of Stock'
              }">
                {{ product.status }}
              </span>
            </div>
            <p class="text-2xl font-semibold text-gray-900 dark:text-white">${{ product.price.toFixed(2) }}</p>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
            <p class="text-gray-700 dark:text-gray-300">{{ product.description }}</p>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Details</h3>
              <ul class="space-y-2">
                <li class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Category:</span>
                  <span class="text-gray-900 dark:text-white">{{ product.category }}</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Manufacturer:</span>
                  <span class="text-gray-900 dark:text-white">{{ product.manufacturer }}</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Stock:</span>
                  <span class="text-gray-900 dark:text-white">{{ product.stock }} {{ product.unit }}s</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Tax Rate:</span>
                  <span class="text-gray-900 dark:text-white">{{ product.taxRate }}%</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Variants</h3>
              <div v-if="product.variants.length > 0">
                <span
                  v-for="variant in product.variants"
                  :key="variant"
                  class="inline-block px-3 py-1 mr-2 mb-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full"
                >
                  {{ variant }}
                </span>
              </div>
              <p v-else class="text-gray-600 dark:text-gray-400">No variants available</p>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Specifications</h3>
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <dl class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <div v-for="(value, key) in product.specifications" :key="key" class="border-b border-gray-200 dark:border-gray-600 pb-2 sm:pb-0">
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ key }}</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ value }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <!-- Similar Products Section -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Similar Products</h3>
              <button
                @click="openSimilarProductsDialog"
                class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Manage
              </button>
            </div>

            <div v-if="similarProducts.length > 0" class="grid grid-cols-2 gap-4">
              <div
                v-for="similarProduct in similarProducts"
                :key="similarProduct.id"
                class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col"
              >
                <img
                  :src="similarProduct.images[0]"
                  :alt="similarProduct.name"
                  class="w-full h-32 object-cover"
                >
                <div class="p-3">
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ similarProduct.name }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ similarProduct.category }}</p>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white mt-1">${{ similarProduct.price.toFixed(2) }}</p>
                </div>
              </div>
            </div>

            <p v-else class="text-gray-600 dark:text-gray-400 text-sm">No similar products available</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center p-8">
      <p class="text-xl text-gray-600 dark:text-gray-400">Product not found</p>
      <button @click="goBack" class="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors">
        Back to Products
      </button>
    </div>

    <!-- Video Modal -->
    <div v-if="showVideoModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Product Video</h3>
          <button @click="closeVideoModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-6">
          <!-- In a real app, you would use a video player component here -->
          <div class="aspect-video bg-black flex items-center justify-center">
            <p class="text-white">Video would play here: {{ activeVideoUrl }}</p>
            <!-- Example of video element (commented out as we don't have real videos) -->
            <!-- <video controls class="w-full h-full">
              <source :src="activeVideoUrl" type="video/mp4">
              Your browser does not support the video tag.
            </video> -->
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Product Dialog -->
    <transition name="fade" appear>
      <Dialog v-if="showEditDialog" @close="showEditDialog = false" class="relative z-50">
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div class="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel class="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Edit Product</h3>
              <button
                class="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1 dark:text-gray-300 dark:hover:text-gray-100"
                @click="showEditDialog = false"
              >
                <div class="i-hugeicons-cancel-01 h-5 w-5"></div>
              </button>
            </div>

            <div v-if="editingProduct" class="space-y-4">
              <!-- Basic Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    id="product-name"
                    v-model="editingProduct.name"
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label for="product-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                  <input
                    id="product-price"
                    v-model.number="editingProduct.price"
                    type="number"
                    step="0.01"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label for="product-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <input
                    id="product-category"
                    v-model="editingProduct.category"
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label for="product-stock" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock</label>
                  <input
                    id="product-stock"
                    v-model.number="editingProduct.stock"
                    type="number"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label for="product-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    id="product-status"
                    v-model="editingProduct.status"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
                <div>
                  <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                  <input
                    id="product-manufacturer"
                    v-model="editingProduct.manufacturer"
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label for="product-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  id="product-description"
                  v-model="editingProduct.description"
                  rows="4"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                ></textarea>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  @click="showEditDialog = false"
                  class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  @click="saveProduct"
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </transition>

    <!-- Similar Products Dialog -->
    <transition name="fade" appear>
      <Dialog v-if="showSimilarProductsDialog" @close="showSimilarProductsDialog = false" class="relative z-50">
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div class="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel class="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Manage Similar Products</h3>
              <button
                class="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1 dark:text-gray-300 dark:hover:text-gray-100"
                @click="showSimilarProductsDialog = false"
              >
                <div class="i-hugeicons-cancel-01 h-5 w-5"></div>
              </button>
            </div>

            <div v-if="editingProduct" class="space-y-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Select products that are similar to <strong>{{ editingProduct.name }}</strong>. These will be shown as recommendations.
              </p>

              <div class="max-h-96 overflow-y-auto border border-gray-200 rounded-md dark:border-gray-700">
                <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                  <li
                    v-for="similarProduct in allProducts.filter(p => p.id !== editingProduct.id)"
                    :key="similarProduct.id"
                    class="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      :id="`similar-product-${similarProduct.id}`"
                      type="checkbox"
                      :value="similarProduct.id"
                      v-model="editingProduct.similarProducts"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
                    />
                    <label :for="`similar-product-${similarProduct.id}`" class="ml-3 flex items-center cursor-pointer">
                      <img :src="similarProduct.images[0]" alt="" class="h-10 w-10 flex-shrink-0 rounded-md object-cover">
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ similarProduct.name }}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">{{ similarProduct.category }} - ${{ similarProduct.price.toFixed(2) }}</p>
                      </div>
                    </label>
                  </li>
                </ul>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  @click="showSimilarProductsDialog = false"
                  class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  @click="saveSimilarProducts"
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </transition>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
