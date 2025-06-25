<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Reviews',
})

// Define review type
interface Review {
  id: number
  productId: number
  productName: string
  productImage: string
  customerName: string
  customerEmail: string
  customerAvatar: string
  rating: number
  title: string
  comment: string
  status: string
  featured: boolean
  dateAdded: string
  helpful: number
  unhelpful: number
}

// Define product type (simplified)
interface Product {
  id: number
  name: string
  imageUrl: string
  category: string
}

// Sample products data (simplified from products page)
const products = ref<Product[]>([
  {
    id: 1,
    name: 'Classic Cheeseburger',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Burgers'
  },
  {
    id: 2,
    name: 'Margherita Pizza',
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Pizza'
  },
  {
    id: 4,
    name: 'Spicy Ramen Bowl',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Asian'
  },
  {
    id: 7,
    name: 'Chocolate Brownie Sundae',
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Desserts'
  },
  {
    id: 9,
    name: 'Chicken Wings (12 pc)',
    imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Appetizers'
  },
  {
    id: 12,
    name: 'Strawberry Cheesecake',
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Desserts'
  }
])

// Sample reviews data
const reviews = ref<Review[]>([
  {
    id: 1,
    productId: 1,
    productName: 'Classic Cheeseburger',
    productImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Alex Johnson',
    customerEmail: 'alex.j@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 5,
    title: 'Best burger in town!',
    comment: 'This cheeseburger is absolutely amazing. The beef patty was juicy and flavorful, and the special sauce really makes it stand out. Will definitely order again!',
    status: 'Published',
    featured: true,
    dateAdded: '2023-12-15',
    helpful: 24,
    unhelpful: 2
  },
  {
    id: 2,
    productId: 2,
    productName: 'Margherita Pizza',
    productImage: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Sarah Miller',
    customerEmail: 'sarah.m@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 4,
    title: 'Authentic Italian taste',
    comment: 'The Margherita pizza was delicious and reminded me of my trip to Naples. The crust was thin and crispy, and the fresh basil really elevated the flavor. My only complaint is that it was a bit small for the price.',
    status: 'Published',
    featured: true,
    dateAdded: '2023-12-10',
    helpful: 18,
    unhelpful: 3
  },
  {
    id: 3,
    productId: 4,
    productName: 'Spicy Ramen Bowl',
    productImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'David Chen',
    customerEmail: 'd.chen@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    rating: 5,
    title: 'Authentic and spicy!',
    comment: 'This ramen is the real deal! The broth was rich and flavorful, and the spice level was perfect for me. The soft-boiled egg was cooked to perfection, and the noodles had just the right texture. Highly recommend!',
    status: 'Published',
    featured: false,
    dateAdded: '2023-12-05',
    helpful: 32,
    unhelpful: 1
  },
  {
    id: 4,
    productId: 7,
    productName: 'Chocolate Brownie Sundae',
    productImage: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Emily Wilson',
    customerEmail: 'emily.w@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/23.jpg',
    rating: 5,
    title: 'Decadent dessert!',
    comment: 'This brownie sundae is to die for! The brownie was warm and gooey, and the ice cream was premium quality. The perfect way to end a meal or satisfy a sweet tooth. Worth every calorie!',
    status: 'Published',
    featured: true,
    dateAdded: '2023-11-28',
    helpful: 41,
    unhelpful: 0
  },
  {
    id: 5,
    productId: 9,
    productName: 'Chicken Wings (12 pc)',
    productImage: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Michael Thompson',
    customerEmail: 'm.thompson@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/42.jpg',
    rating: 3,
    title: 'Good but not great',
    comment: 'The wings were crispy and the portion size was generous, but I found the Buffalo sauce to be a bit too vinegary for my taste. The Honey Garlic flavor was much better. Service was quick though!',
    status: 'Published',
    featured: false,
    dateAdded: '2023-11-20',
    helpful: 8,
    unhelpful: 5
  },
  {
    id: 6,
    productId: 12,
    productName: 'Strawberry Cheesecake',
    productImage: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Jessica Lee',
    customerEmail: 'jessica.l@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/56.jpg',
    rating: 4,
    title: 'Creamy and delicious',
    comment: 'This cheesecake has the perfect texture - creamy but not too heavy. The strawberry topping was made with fresh berries and not too sweet. My only suggestion would be to have a slightly thicker crust.',
    status: 'Published',
    featured: false,
    dateAdded: '2023-11-15',
    helpful: 15,
    unhelpful: 2
  },
  {
    id: 7,
    productId: 1,
    productName: 'Classic Cheeseburger',
    productImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Robert Garcia',
    customerEmail: 'r.garcia@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/78.jpg',
    rating: 2,
    title: 'Disappointed with my order',
    comment: 'I was really looking forward to this burger, but it arrived cold and the bun was soggy. The patty itself was tasty, but the overall experience was disappointing. Hope they can improve their delivery packaging.',
    status: 'Under Review',
    featured: false,
    dateAdded: '2023-12-18',
    helpful: 3,
    unhelpful: 1
  },
  {
    id: 8,
    productId: 4,
    productName: 'Spicy Ramen Bowl',
    productImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Sophia Martinez',
    customerEmail: 's.martinez@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    rating: 5,
    title: 'Perfect comfort food!',
    comment: 'This ramen bowl is exactly what I needed on a cold day. The broth was rich and flavorful, and the spice level was just right - enough to warm you up without being overwhelming. The noodles had the perfect texture and the toppings were generous. Will definitely order again!',
    status: 'Published',
    featured: true,
    dateAdded: '2023-12-01',
    helpful: 27,
    unhelpful: 0
  },
  {
    id: 9,
    productId: 2,
    productName: 'Margherita Pizza',
    productImage: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Daniel Brown',
    customerEmail: 'd.brown@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    rating: 1,
    title: 'Not what I expected',
    comment: 'I was very disappointed with this pizza. The crust was burnt on the bottom and the cheese was barely melted. For the price, I expected much better quality. Will not be ordering this again.',
    status: 'Under Review',
    featured: false,
    dateAdded: '2023-12-17',
    helpful: 5,
    unhelpful: 2
  },
  {
    id: 10,
    productId: 7,
    productName: 'Chocolate Brownie Sundae',
    productImage: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Olivia Taylor',
    customerEmail: 'o.taylor@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    rating: 4,
    title: 'Great dessert option',
    comment: 'This brownie sundae was a delightful treat! The brownie was rich and chocolatey, and the ice cream complemented it perfectly. My only suggestion would be to add more chocolate sauce. Otherwise, it was perfect!',
    status: 'Published',
    featured: false,
    dateAdded: '2023-11-25',
    helpful: 19,
    unhelpful: 3
  },
  {
    id: 11,
    productId: 9,
    productName: 'Chicken Wings (12 pc)',
    productImage: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'William Clark',
    customerEmail: 'w.clark@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/men/52.jpg',
    rating: 5,
    title: 'Best wings in town!',
    comment: 'These wings are absolutely fantastic! I tried all three flavors and they were all delicious, but the BBQ was my favorite. The wings were meaty and cooked perfectly - crispy on the outside and juicy on the inside. Great value for the price too!',
    status: 'Published',
    featured: true,
    dateAdded: '2023-11-10',
    helpful: 38,
    unhelpful: 1
  },
  {
    id: 12,
    productId: 12,
    productName: 'Strawberry Cheesecake',
    productImage: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    customerName: 'Emma Wilson',
    customerEmail: 'e.wilson@example.com',
    customerAvatar: 'https://randomuser.me/api/portraits/women/33.jpg',
    rating: 3,
    title: 'Good but not great',
    comment: 'The cheesecake itself had a nice texture and wasn\'t too sweet, which I appreciated. However, the strawberry topping tasted a bit artificial to me. I would have preferred fresh strawberries. It was still enjoyable, just not exceptional.',
    status: 'Published',
    featured: false,
    dateAdded: '2023-12-08',
    helpful: 7,
    unhelpful: 4
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('dateAdded')
const sortOrder = ref('desc')
const productFilter = ref('all')
const ratingFilter = ref('all')
const statusFilter = ref('all')
const viewMode = ref('detailed') // 'detailed' or 'compact'

// Available statuses
const statuses = ['all', 'Published', 'Under Review', 'Rejected', 'Spam']

// Available ratings
const ratings = ['all', '5', '4', '3', '2', '1']

// Computed filtered and sorted reviews
const filteredReviews = computed(() => {
  return reviews.value
    .filter(review => {
      // Apply search filter
      const matchesSearch =
        review.customerName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.comment.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.productName.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply product filter
      const matchesProduct = productFilter.value === 'all' || review.productId.toString() === productFilter.value

      // Apply rating filter
      const matchesRating = ratingFilter.value === 'all' || review.rating.toString() === ratingFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || review.status === statusFilter.value

      return matchesSearch && matchesProduct && matchesRating && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'dateAdded') {
        comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
      } else if (sortBy.value === 'rating') {
        comparison = a.rating - b.rating
      } else if (sortBy.value === 'helpful') {
        comparison = a.helpful - b.helpful
      } else if (sortBy.value === 'customerName') {
        comparison = a.customerName.localeCompare(b.customerName)
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredReviews.value.length / itemsPerPage.value))

const paginatedReviews = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredReviews.value.slice(start, end)
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
    case 'Published':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Under Review':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Rejected':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    case 'Spam':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get rating stars
function getRatingStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

// Modal state for editing review
const showReviewModal = ref(false)
const currentReview = ref<Review | null>(null)

function openEditReviewModal(review: Review): void {
  currentReview.value = { ...review }
  showReviewModal.value = true
}

function closeReviewModal(): void {
  showReviewModal.value = false
}

function saveReview(): void {
  if (!currentReview.value) return

  // Update existing review
  const index = reviews.value.findIndex(r => r.id === currentReview.value!.id)
  if (index !== -1) {
    reviews.value[index] = { ...currentReview.value }
  }

  closeReviewModal()
}

// Calculate summary statistics
const totalReviews = computed(() => reviews.value.length)
const publishedReviews = computed(() => reviews.value.filter(r => r.status === 'Published').length)
const averageRating = computed(() => {
  const total = reviews.value.reduce((sum, review) => sum + review.rating, 0)
  return (total / reviews.value.length).toFixed(1)
})
const pendingReviews = computed(() => reviews.value.filter(r => r.status === 'Under Review').length)

// Feature or unfeature a review
function toggleFeature(review: Review): void {
  const index = reviews.value.findIndex(r => r.id === review.id)
  if (index !== -1) {
    const reviewToUpdate = reviews.value[index]
    if (reviewToUpdate) {
      reviewToUpdate.featured = !reviewToUpdate.featured
    }
  }
}

// Change review status
function updateReviewStatus(review: Review, newStatus: string): void {
  const index = reviews.value.findIndex(r => r.id === review.id)
  if (index !== -1) {
    const reviewToUpdate = reviews.value[index]
    if (reviewToUpdate) {
      reviewToUpdate.status = newStatus
    }
  }
}

// Delete review
function deleteReview(reviewId: number): void {
  const index = reviews.value.findIndex(r => r.id === reviewId)
  if (index !== -1) {
    reviews.value.splice(index, 1)
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
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Reviews</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage customer reviews for your products
            </p>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-bubble-chat h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalReviews }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Published reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Published Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ publishedReviews }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Average rating card -->
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
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Average Rating</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ averageRating }} / 5</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Pending reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-orange-100 p-2 dark:bg-orange-900">
                    <div class="i-hugeicons-clock-01 h-6 w-6 text-orange-600 dark:text-orange-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ pendingReviews }}</div>
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
              placeholder="Search reviews..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Product filter -->
            <select
              v-model="productFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Products</option>
              <option v-for="product in products" :key="product.id" :value="product.id.toString()">
                {{ product.name }}
              </option>
            </select>

            <!-- Rating filter -->
            <select
              v-model="ratingFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Ratings</option>
              <option v-for="rating in ratings.slice(1)" :key="rating" :value="rating">
                {{ rating }} Stars
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
                @click="viewMode = 'detailed'"
                :class="[
                  'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-grid h-5 w-5"></div>
              </button>
              <button
                type="button"
                @click="viewMode = 'compact'"
                :class="[
                  'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'compact'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-list-view h-5 w-5"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Sort options -->
        <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span class="mr-2">Sort by:</span>
          <button
            @click="toggleSort('dateAdded')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'dateAdded' }"
          >
            Date
            <span v-if="sortBy === 'dateAdded'" class="ml-1">
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
            @click="toggleSort('helpful')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'helpful' }"
          >
            Helpful
            <span v-if="sortBy === 'helpful'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('customerName')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'customerName' }"
          >
            Customer
            <span v-if="sortBy === 'customerName'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Detailed view -->
        <div v-if="viewMode === 'detailed'" class="mt-6">
          <div v-if="paginatedReviews.length === 0" class="py-12 text-center">
            <div class="i-hugeicons-bubble-chat mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No reviews found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter to find what you're looking for.</p>
          </div>

          <div v-else class="space-y-6">
            <!-- Review card -->
            <div
              v-for="review in paginatedReviews"
              :key="review.id"
              class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-blue-gray-800"
            >
              <div class="p-6">
                <div class="flex items-start justify-between">
                  <!-- Customer info and rating -->
                  <div class="flex items-start space-x-4">
                    <img
                      :src="review.customerAvatar"
                      :alt="review.customerName"
                      class="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 class="text-base font-medium text-gray-900 dark:text-white">{{ review.customerName }}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ review.customerEmail }}</p>
                      <div class="mt-1 flex items-center">
                        <span class="text-yellow-400 text-lg">{{ getRatingStars(review.rating) }}</span>
                        <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">{{ review.dateAdded }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Status badge and featured tag -->
                  <div class="flex flex-col items-end space-y-2">
                    <span
                      :class="[getStatusClass(review.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']"
                    >
                      {{ review.status }}
                    </span>
                    <span
                      v-if="review.featured"
                      class="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400"
                    >
                      Featured
                    </span>
                  </div>
                </div>

                <!-- Product info -->
                <div class="mt-4 flex items-center">
                  <img
                    :src="review.productImage"
                    :alt="review.productName"
                    class="h-10 w-10 rounded-md object-cover"
                  />
                  <div class="ml-3">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ review.productName }}</h4>
                  </div>
                </div>

                <!-- Review content -->
                <div class="mt-4">
                  <h4 class="text-base font-medium text-gray-900 dark:text-white">{{ review.title }}</h4>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ review.comment }}</p>
                </div>

                <!-- Helpful metrics -->
                <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div class="i-hugeicons-thumbs-up h-4 w-4 mr-1"></div>
                    <span>{{ review.helpful }} helpful</span>
                  </div>
                  <div class="ml-4 flex items-center">
                    <div class="i-hugeicons-thumbs-down h-4 w-4 mr-1"></div>
                    <span>{{ review.unhelpful }} unhelpful</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="mt-4 flex justify-end space-x-3">
                  <button
                    @click="toggleFeature(review)"
                    class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                  >
                    <div v-if="review.featured" class="i-hugeicons-star-off h-4 w-4 mr-1"></div>
                    <div v-else class="i-hugeicons-star h-4 w-4 mr-1"></div>
                    {{ review.featured ? 'Unfeature' : 'Feature' }}
                  </button>
                  <button
                    v-if="review.status !== 'Published'"
                    @click="updateReviewStatus(review, 'Published')"
                    class="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1.5 text-sm font-semibold text-green-700 shadow-sm ring-1 ring-inset ring-green-600/20 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                  >
                    <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1"></div>
                    Approve
                  </button>
                  <button
                    v-if="review.status !== 'Rejected'"
                    @click="updateReviewStatus(review, 'Rejected')"
                    class="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-600/20 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    <div class="i-hugeicons-cancel-circle h-4 w-4 mr-1"></div>
                    Reject
                  </button>
                  <button
                    @click="openEditReviewModal(review)"
                    class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-edit-01 h-4 w-4 mr-1"></div>
                    Edit
                  </button>
                  <button
                    @click="deleteReview(review.id)"
                    class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Compact view -->
        <div v-if="viewMode === 'compact'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Customer</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Product</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Rating</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Review</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedReviews.length === 0">
                <td colspan="7" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No reviews found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="review in paginatedReviews" :key="review.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="h-8 w-8 flex-shrink-0">
                      <img :src="review.customerAvatar" :alt="review.customerName" class="h-8 w-8 rounded-full object-cover" />
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ review.customerName }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{{ review.customerEmail }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div class="flex items-center">
                    <div class="h-8 w-8 flex-shrink-0">
                      <img :src="review.productImage" :alt="review.productName" class="h-8 w-8 rounded-md object-cover" />
                    </div>
                    <div class="ml-2 text-gray-900 dark:text-white">{{ review.productName }}</div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span class="text-yellow-400">{{ getRatingStars(review.rating) }}</span>
                </td>
                <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  <div class="font-medium text-gray-900 dark:text-white">{{ review.title }}</div>
                  <div class="truncate">{{ review.comment }}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(review.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
                    {{ review.status }}
                  </span>
                  <span
                    v-if="review.featured"
                    class="mt-1 inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400"
                  >
                    Featured
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ review.dateAdded }}</td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      @click="openEditReviewModal(review)"
                      type="button"
                      class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit, {{ review.customerName }}'s review</span>
                    </button>
                    <button
                      @click="deleteReview(review.id)"
                      type="button"
                      class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete, {{ review.customerName }}'s review</span>
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
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredReviews.length) }}</span> of
                <span class="font-medium">{{ filteredReviews.length }}</span> results
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

    <!-- Edit Review Modal -->
    <div v-if="showReviewModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closeReviewModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-circle h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Edit Review
              </h3>
              <div class="mt-4">
                <form @submit.prevent="saveReview" class="space-y-4">
                  <!-- Customer and product info (read-only) -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <img
                        v-if="currentReview"
                        :src="currentReview.customerAvatar"
                        :alt="currentReview.customerName"
                        class="h-10 w-10 rounded-full object-cover"
                      />
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ currentReview?.customerName }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ currentReview?.customerEmail }}</p>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <img
                        v-if="currentReview"
                        :src="currentReview.productImage"
                        :alt="currentReview.productName"
                        class="h-10 w-10 rounded-md object-cover"
                      />
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ currentReview?.productName }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Rating -->
                  <div>
                    <label for="review-rating" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Rating</label>
                    <select
                      id="review-rating"
                      v-if="currentReview"
                      v-model="currentReview.rating"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option v-for="rating in [1, 2, 3, 4, 5]" :key="rating" :value="rating">
                        {{ rating }} {{ rating === 1 ? 'Star' : 'Stars' }}
                      </option>
                    </select>
                  </div>

                  <!-- Review title -->
                  <div>
                    <label for="review-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                    <input
                      type="text"
                      id="review-title"
                      v-if="currentReview"
                      v-model="currentReview.title"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- Review comment -->
                  <div>
                    <label for="review-comment" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Comment</label>
                    <textarea
                      id="review-comment"
                      v-if="currentReview"
                      v-model="currentReview.comment"
                      rows="4"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    ></textarea>
                  </div>

                  <!-- Status -->
                  <div>
                    <label for="review-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      id="review-status"
                      v-if="currentReview"
                      v-model="currentReview.status"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option v-for="status in statuses.slice(1)" :key="status" :value="status">{{ status }}</option>
                    </select>
                  </div>

                  <!-- Featured -->
                  <div class="flex items-center">
                    <input
                      id="review-featured"
                      type="checkbox"
                      v-if="currentReview"
                      v-model="currentReview.featured"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                    />
                    <label for="review-featured" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Featured review</label>
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      @click="closeReviewModal"
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
