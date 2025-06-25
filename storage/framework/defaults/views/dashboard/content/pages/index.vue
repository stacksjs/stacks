<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar, Doughnut } from 'vue-chartjs'
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
  title: 'Dashboard - Website Pages',
})

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

// Sample pages data
const pages = ref([
  {
    id: 1,
    title: 'Home',
    slug: 'home',
    template: 'Default',
    sections: ['Hero', 'Features', 'Testimonials', 'CTA'],
    author: 'Jane Doe',
    views: 24500,
    conversions: 520,
    published: '2023-10-15',
    status: 'Published',
    isHomepage: true,
    inMainMenu: true,
    inFooter: false,
    seo: {
      title: 'Welcome to Our Website',
      description: 'Your ultimate destination for amazing products and services',
      keywords: 'home, products, services'
    },
    ogImage: 'https://picsum.photos/seed/1/280/160'
  },
  {
    id: 2,
    title: 'About Us',
    slug: 'about-us',
    template: 'Default',
    sections: ['Header', 'Team', 'Mission', 'Values'],
    author: 'John Smith',
    views: 12300,
    conversions: 0,
    published: '2023-10-20',
    status: 'Published',
    isHomepage: false,
    inMainMenu: true,
    inFooter: true,
    seo: {
      title: 'About Our Company',
      description: 'Learn about our mission, values, and the team behind our success',
      keywords: 'about, team, mission, values'
    },
    ogImage: 'https://picsum.photos/seed/2/280/160'
  },
  {
    id: 3,
    title: 'Services',
    slug: 'services',
    template: 'Services',
    sections: ['Header', 'ServicesList', 'Pricing', 'FAQ'],
    author: 'Jane Doe',
    views: 18500,
    conversions: 320,
    published: '2023-11-05',
    status: 'Published',
    isHomepage: false,
    inMainMenu: true,
    inFooter: true,
    seo: {
      title: 'Our Professional Services',
      description: 'Explore our range of professional services designed to meet your needs',
      keywords: 'services, professional, solutions'
    },
    ogImage: 'https://picsum.photos/seed/3/280/160'
  },
  {
    id: 4,
    title: 'Products',
    slug: 'products',
    template: 'Products',
    sections: ['Header', 'FeaturedProducts', 'Categories', 'BestSellers'],
    author: 'Michael Brown',
    views: 20100,
    conversions: 450,
    published: '2023-11-10',
    status: 'Published',
    isHomepage: false,
    inMainMenu: true,
    inFooter: true,
    seo: {
      title: 'Our Product Catalog',
      description: 'Browse our extensive catalog of high-quality products',
      keywords: 'products, catalog, shop'
    },
    ogImage: 'https://picsum.photos/seed/4/280/160'
  },
  {
    id: 5,
    title: 'Contact',
    slug: 'contact',
    template: 'Contact',
    sections: ['Header', 'ContactForm', 'Map', 'ContactInfo'],
    author: 'Emily Davis',
    views: 9800,
    conversions: 180,
    published: '2023-11-15',
    status: 'Published',
    isHomepage: false,
    inMainMenu: true,
    inFooter: true,
    seo: {
      title: 'Contact Us',
      description: 'Get in touch with our team for inquiries, support, or feedback',
      keywords: 'contact, support, help'
    },
    ogImage: 'https://picsum.photos/seed/5/280/160'
  },
  {
    id: 6,
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    template: 'Legal',
    sections: ['Header', 'Content'],
    author: 'John Smith',
    views: 3200,
    conversions: 0,
    published: '2023-11-20',
    status: 'Published',
    isHomepage: false,
    inMainMenu: false,
    inFooter: true,
    seo: {
      title: 'Privacy Policy',
      description: 'Our privacy policy and how we protect your data',
      keywords: 'privacy, policy, data protection'
    },
    ogImage: 'https://picsum.photos/seed/6/280/160'
  },
  {
    id: 7,
    title: 'Terms of Service',
    slug: 'terms-of-service',
    template: 'Legal',
    sections: ['Header', 'Content'],
    author: 'John Smith',
    views: 2800,
    conversions: 0,
    published: '2023-11-20',
    status: 'Published',
    isHomepage: false,
    inMainMenu: false,
    inFooter: true,
    seo: {
      title: 'Terms of Service',
      description: 'Our terms of service and conditions of use',
      keywords: 'terms, service, conditions'
    },
    ogImage: 'https://picsum.photos/seed/7/280/160'
  },
  {
    id: 8,
    title: 'FAQ',
    slug: 'faq',
    template: 'FAQ',
    sections: ['Header', 'FAQAccordion'],
    author: 'Emily Davis',
    views: 7500,
    conversions: 120,
    published: '2023-11-25',
    status: 'Published',
    isHomepage: false,
    inMainMenu: false,
    inFooter: true,
    seo: {
      title: 'Frequently Asked Questions',
      description: 'Find answers to commonly asked questions about our products and services',
      keywords: 'faq, questions, answers, help'
    },
    ogImage: 'https://picsum.photos/seed/8/280/160'
  },
  {
    id: 9,
    title: 'Testimonials',
    slug: 'testimonials',
    template: 'Testimonials',
    sections: ['Header', 'TestimonialsList'],
    author: 'Jane Doe',
    views: 5400,
    conversions: 90,
    published: '2023-12-01',
    status: 'Published',
    isHomepage: false,
    inMainMenu: false,
    inFooter: false,
    seo: {
      title: 'Customer Testimonials',
      description: 'See what our customers are saying about our products and services',
      keywords: 'testimonials, reviews, feedback'
    },
    ogImage: 'https://picsum.photos/seed/9/280/160'
  },
  {
    id: 10,
    title: 'New Landing Page',
    slug: 'new-landing-page',
    template: 'Landing',
    sections: ['Hero', 'Features', 'Pricing', 'CTA'],
    author: 'Michael Brown',
    views: 0,
    conversions: 0,
    published: '',
    status: 'Draft',
    isHomepage: false,
    inMainMenu: false,
    inFooter: false,
    seo: {
      title: 'Special Offer Landing Page',
      description: 'Limited time offer on our premium products',
      keywords: 'offer, special, limited time'
    },
    ogImage: 'https://picsum.photos/seed/10/280/160'
  }
])

// Generate monthly data for charts
const monthlyChartData = computed(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Sample data - in a real app, this would be calculated from actual page data
  const viewsData = [3200, 4100, 3800, 4500, 5200, 4900, 5500, 6200, 6800, 6400, 7200, 7800]
  const pagesData = [2, 3, 1, 4, 2, 3, 5, 2, 4, 3, 2, 6]
  const conversionData = [2.1, 2.4, 2.2, 2.6, 2.8, 2.5, 3.0, 3.2, 3.5, 3.3, 3.6, 3.8]

  // Views chart data
  const viewsChartData = {
    labels: months,
    datasets: [
      {
        label: 'Page Views',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: viewsData,
      },
    ],
  }

  // Pages and conversions chart data
  const pagesConversionsChartData = {
    labels: months,
    datasets: [
      {
        label: 'Pages Published',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: pagesData,
      },
      {
        label: 'Conversion Rate (%)',
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: conversionData,
      },
    ],
  }

  // Template distribution chart data
  const templateCounts: Record<string, number> = {}

  pages.value.forEach(page => {
    if (page.template) {
      templateCounts[page.template] = (templateCounts[page.template] || 0) + 1
    }
  })

  const templateLabels = Object.keys(templateCounts)
  const templateData = Object.values(templateCounts)
  const backgroundColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ]

  const templateChartData = {
    labels: templateLabels,
    datasets: [
      {
        data: templateData,
        backgroundColor: backgroundColors.slice(0, templateLabels.length),
        borderWidth: 0,
      },
    ],
  }

  return {
    viewsChartData,
    pagesConversionsChartData,
    templateChartData,
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Templates for filtering
const templates = [
  { id: 1, name: 'All Templates' },
  { id: 2, name: 'Default' },
  { id: 3, name: 'Services' },
  { id: 4, name: 'Products' },
  { id: 5, name: 'Contact' },
  { id: 6, name: 'Legal' },
  { id: 7, name: 'FAQ' },
  { id: 8, name: 'Testimonials' },
  { id: 9, name: 'Landing' }
]

// Statuses for filtering
const statuses = [
  { id: 1, name: 'All Statuses' },
  { id: 2, name: 'Published' },
  { id: 3, name: 'Draft' },
  { id: 4, name: 'Scheduled' },
  { id: 5, name: 'Archived' }
]

// Locations for filtering
const locations = [
  { id: 1, name: 'All Locations' },
  { id: 2, name: 'Main Menu' },
  { id: 3, name: 'Footer' },
  { id: 4, name: 'Homepage' },
  { id: 5, name: 'Not in Menu' }
]

// Filter and sort options
const searchQuery = ref('')
const selectedTemplate = ref('All Templates')
const selectedStatus = ref('All Statuses')
const selectedLocation = ref('All Locations')
const sortBy = ref('published')
const sortOrder = ref('desc')

// New Page Modal
const showNewPageModal = ref(false)
const newPage = ref({
  title: '',
  slug: '',
  template: 'Default',
  sections: [],
  content: '',
  status: 'Draft',
  isHomepage: false,
  inMainMenu: false,
  inFooter: false,
  seo: {
    title: '',
    description: '',
    keywords: ''
  },
  ogImage: 'https://picsum.photos/seed/new/280/160'
})

// Available sections by template
const availableSections = computed(() => {
  switch (newPage.value.template) {
    case 'Default':
      return ['Header', 'Content', 'Hero', 'Features', 'Testimonials', 'CTA', 'Team', 'Partners', 'Gallery'];
    case 'Services':
      return ['Header', 'ServicesList', 'Pricing', 'FAQ', 'Testimonials', 'CTA'];
    case 'Products':
      return ['Header', 'FeaturedProducts', 'Categories', 'BestSellers', 'ProductGrid', 'CTA'];
    case 'Contact':
      return ['Header', 'ContactForm', 'Map', 'ContactInfo', 'FAQ'];
    case 'Legal':
      return ['Header', 'Content'];
    case 'FAQ':
      return ['Header', 'FAQAccordion', 'ContactCTA'];
    case 'Testimonials':
      return ['Header', 'TestimonialsList', 'CTA'];
    case 'Landing':
      return ['Hero', 'Features', 'Benefits', 'Pricing', 'Testimonials', 'FAQ', 'CTA'];
    default:
      return ['Header', 'Content'];
  }
})

function openNewPageModal() {
  showNewPageModal.value = true
}

function closeNewPageModal() {
  showNewPageModal.value = false
  // Reset form
  newPage.value = {
    title: '',
    slug: '',
    template: 'Default',
    sections: [],
    content: '',
    status: 'Draft',
    isHomepage: false,
    inMainMenu: false,
    inFooter: false,
    seo: {
      title: '',
      description: '',
      keywords: ''
    },
    ogImage: 'https://picsum.photos/seed/new/280/160'
  }
}

function createNewPage() {
  // In a real app, this would send data to the server
  const page = {
    id: pages.value.length + 1,
    title: newPage.value.title,
    slug: newPage.value.slug || newPage.value.title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-'),
    template: newPage.value.template,
    sections: newPage.value.sections || [],
    author: 'Current User', // In a real app, this would be the current user
    views: 0,
    conversions: 0,
    published: newPage.value.status === 'Published' ? new Date().toISOString().split('T')[0] : '',
    status: newPage.value.status,
    isHomepage: newPage.value.isHomepage,
    inMainMenu: newPage.value.inMainMenu,
    inFooter: newPage.value.inFooter,
    seo: {
      title: newPage.value.seo.title || newPage.value.title,
      description: newPage.value.seo.description || '',
      keywords: newPage.value.seo.keywords || ''
    },
    ogImage: newPage.value.ogImage
  }

  // If this is set as homepage, unset any existing homepage
  if (page.isHomepage) {
    pages.value.forEach(p => {
      if (p.isHomepage) {
        p.isHomepage = false
      }
    })
  }

  pages.value.unshift(page as any) // Type assertion to fix the linter error
  closeNewPageModal()
}

// Computed filtered and sorted pages
const filteredPages = computed(() => {
  return pages.value
    .filter(page => {
      // Apply search filter
      const matchesSearch =
        page.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        page.slug.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        page.author.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply template filter
      const matchesTemplate = selectedTemplate.value === 'All Templates' || page.template === selectedTemplate.value

      // Apply status filter
      const matchesStatus = selectedStatus.value === 'All Statuses' || page.status === selectedStatus.value

      // Apply location filter
      let matchesLocation = true
      if (selectedLocation.value === 'Main Menu') {
        matchesLocation = page.inMainMenu
      } else if (selectedLocation.value === 'Footer') {
        matchesLocation = page.inFooter
      } else if (selectedLocation.value === 'Homepage') {
        matchesLocation = page.isHomepage
      } else if (selectedLocation.value === 'Not in Menu') {
        matchesLocation = !page.inMainMenu && !page.inFooter
      }

      return matchesSearch && matchesTemplate && matchesStatus && matchesLocation
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'title') {
        comparison = a.title.localeCompare(b.title)
      } else if (sortBy.value === 'author') {
        comparison = a.author.localeCompare(b.author)
      } else if (sortBy.value === 'views') {
        comparison = a.views - b.views
      } else if (sortBy.value === 'conversions') {
        comparison = a.conversions - b.conversions
      } else if (sortBy.value === 'published') {
        // Handle draft pages (empty published date)
        if (!a.published && !b.published) return 0
        if (!a.published) return 1
        if (!b.published) return -1
        return new Date(a.published).getTime() - new Date(b.published).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredPages.value.length / itemsPerPage.value))

const paginatedPages = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredPages.value.slice(start, end)
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
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'Draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Archived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format date
function formatDate(dateString: string): string {
  if (!dateString) return 'Not published'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Bulk actions
const selectedPageIds = ref<number[]>([])
const selectAll = ref(false)

function toggleSelectAll(): void {
  if (selectAll.value) {
    selectedPageIds.value = paginatedPages.value.map(page => page.id)
  } else {
    selectedPageIds.value = []
  }
}

function togglePageSelection(pageId: number): void {
  const index = selectedPageIds.value.indexOf(pageId)
  if (index === -1) {
    selectedPageIds.value.push(pageId)
  } else {
    selectedPageIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all pages are selected
  selectAll.value = paginatedPages.value.every(page => selectedPageIds.value.includes(page.id))
}

const hasSelectedPages = computed(() => selectedPageIds.value.length > 0)

// Toggle page location (menu, footer, homepage)
function toggleHomepage(pageId: number): void {
  const page = pages.value.find(p => p.id === pageId)
  if (page) {
    // First unset any existing homepage
    if (!page.isHomepage) {
      pages.value.forEach(p => {
        if (p.isHomepage) {
          p.isHomepage = false
        }
      })
      page.isHomepage = true
    }
  }
}

function toggleMainMenu(pageId: number): void {
  const page = pages.value.find(p => p.id === pageId)
  if (page) {
    page.inMainMenu = !page.inMainMenu
  }
}

function toggleFooter(pageId: number): void {
  const page = pages.value.find(p => p.id === pageId)
  if (page) {
    page.inFooter = !page.inFooter
  }
}

// Computed website statistics
const websiteStats = computed(() => {
  // Count pages by status
  const publishedPages = pages.value.filter(page => page.status === 'Published').length
  const draftPages = pages.value.filter(page => page.status === 'Draft').length
  const scheduledPages = pages.value.filter(page => page.status === 'Scheduled').length
  const archivedPages = pages.value.filter(page => page.status === 'Archived').length

  // Calculate total views and conversions
  const totalViews = pages.value.reduce((sum, page) => sum + page.views, 0)
  const totalConversions = pages.value.reduce((sum, page) => sum + page.conversions, 0)

  // Calculate conversion rate
  const conversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(2) : '0.00'

  // Calculate average views per page
  const publishedPagesCount = Math.max(1, publishedPages) // Avoid division by zero
  const avgViewsPerPage = Math.round(totalViews / publishedPagesCount)

  // Find most viewed page
  let mostViewedPage = pages.value[0] || { title: 'None', views: 0 }

  for (const page of pages.value) {
    if (page.views > mostViewedPage.views) {
      mostViewedPage = page
    }
  }

  // Find page with highest conversion
  let highestConversionPage = { page: pages.value[0] || { title: 'None' }, rate: 0 }

  for (const page of pages.value) {
    if (page.views > 0) {
      const rate = (page.conversions / page.views) * 100
      if (rate > highestConversionPage.rate) {
        highestConversionPage = { page, rate }
      }
    }
  }

  return {
    totalPages: pages.value.length,
    publishedPages,
    draftPages,
    scheduledPages,
    archivedPages,
    totalViews,
    totalConversions,
    conversionRate,
    avgViewsPerPage,
    mostViewedPage,
    highestConversionPage
  }
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Pages</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage all your website pages
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openNewPageModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              New Page
            </button>
          </div>
        </div>

        <!-- Time range selector -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Overview of your website performance
          </p>
          <div class="relative">
            <select v-model="timeRange" class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
              <option v-for="range in timeRanges" :key="range" :value="range">{{ range }}</option>
            </select>
          </div>
        </div>

        <!-- Stats -->
        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Pages</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ websiteStats.totalPages }}</dd>
            <dd class="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ websiteStats.publishedPages }} published, {{ websiteStats.draftPages }} drafts</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Views</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ websiteStats.totalViews.toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ websiteStats.avgViewsPerPage.toLocaleString() }} avg per page</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Conversion Rate</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ websiteStats.conversionRate }}%</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ websiteStats.totalConversions }} total conversions</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Most Viewed Page</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ websiteStats.mostViewedPage.title }}</dd>
            <dd class="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ websiteStats.mostViewedPage.views.toLocaleString() }} views</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800 lg:col-span-2">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Page Views</h3>
              <div class="mt-2 h-80">
                <Line :data="monthlyChartData.viewsChartData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Template Distribution</h3>
              <div class="mt-2 h-80">
                <Doughnut :data="monthlyChartData.templateChartData" :options="doughnutChartOptions" />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-1">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Pages & Conversions</h3>
              <div class="mt-2 h-80">
                <Bar :data="monthlyChartData.pagesConversionsChartData" :options="chartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search pages..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="selectedTemplate"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 sm:min-w-[180px]"
            >
              <option v-for="template in templates" :key="template.id" :value="template.name">{{ template.name }}</option>
            </select>

            <select
              v-model="selectedStatus"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="status in statuses" :key="status.id" :value="status.name">{{ status.name }}</option>
            </select>

            <select
              v-model="selectedLocation"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="location in locations" :key="location.id" :value="location.name">{{ location.name }}</option>
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
        <div v-if="hasSelectedPages" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-info-circle h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-700 dark:text-blue-300">{{ selectedPageIds.length }} pages selected</span>
            </div>
            <div class="flex space-x-2">
              <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                <div class="i-hugeicons-archive-box h-4 w-4 mr-1"></div>
                Archive
              </button>
              <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                <div class="i-hugeicons-duplicate h-4 w-4 mr-1"></div>
                Duplicate
              </button>
              <button type="button" class="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Active location filter -->
        <div v-if="selectedLocation !== 'All Locations'" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="i-hugeicons-map-pin-01 h-5 w-5 text-blue-400 mr-2"></div>
              <span class="text-sm text-blue-700 dark:text-blue-300">
                Filtering by location: <span class="font-medium">{{ selectedLocation }}</span>
              </span>
            </div>
            <button
              @click="selectedLocation = 'All Locations'"
              class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-cancel-01 h-4 w-4 mr-1"></div>
              Clear Filter
            </button>
          </div>
        </div>

        <!-- Pages table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Pages</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all website pages including title, template, views, and status.
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
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <!-- OG Image column (no header text) -->
                      </th>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('title')" class="group inline-flex items-center">
                          Title
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'title'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('author')" class="group inline-flex items-center">
                          Author
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'author'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Template</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('views')" class="group inline-flex items-center">
                          Views
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'views'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('conversions')" class="group inline-flex items-center">
                          Conversions
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'conversions'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('published')" class="group inline-flex items-center">
                          Published
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'published'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Location</th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                    <tr v-for="page in paginatedPages" :key="page.id" :class="{ 'bg-blue-50 dark:bg-blue-900/10': selectedPageIds.includes(page.id) }">
                      <td class="relative py-4 pl-3 pr-4 text-sm font-medium sm:pr-6">
                        <div class="flex items-center">
                          <input
                            :id="`page-${page.id}`"
                            type="checkbox"
                            :checked="selectedPageIds.includes(page.id)"
                            @change="togglePageSelection(page.id)"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                          />
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div class="h-16 w-28 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <img
                            :src="page.ogImage"
                            :alt="`OG image for ${page.title}`"
                            class="h-full w-full object-cover"
                          />
                        </div>
                      </td>
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        <div class="flex items-center">
                          <div>
                            <div class="font-medium">{{ page.title }}</div>
                            <div class="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <span class="truncate">{{ page.slug }}</span>
                            </div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              <span v-for="section in page.sections.slice(0, 3)" :key="section" class="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300">
                                {{ section }}
                              </span>
                              <span v-if="page.sections.length > 3" class="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300">
                                +{{ page.sections.length - 3 }} more
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ page.author }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ page.template }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ page.views.toLocaleString() }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ page.conversions }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ formatDate(page.published) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(page.status)">
                          {{ page.status }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <div class="flex flex-col gap-1">
                          <button
                            @click="toggleHomepage(page.id)"
                            class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                            :class="page.isHomepage ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'"
                          >
                            <div class="i-hugeicons-home-01 h-3 w-3 mr-1"></div>
                            Homepage
                          </button>
                          <button
                            @click="toggleMainMenu(page.id)"
                            class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                            :class="page.inMainMenu ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'"
                          >
                            <div class="i-hugeicons-menu-01 h-3 w-3 mr-1"></div>
                            Menu
                          </button>
                          <button
                            @click="toggleFooter(page.id)"
                            class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                            :class="page.inFooter ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'"
                          >
                            <div class="i-hugeicons-layout-bottom h-3 w-3 mr-1"></div>
                            Footer
                          </button>
                        </div>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="paginatedPages.length === 0">
                      <td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No pages found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="mt-6 flex items-center justify-between">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredPages.length) }}</span> of
            <span class="font-medium">{{ filteredPages.length }}</span> results
          </div>
          <div class="flex space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === 1
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
            </button>
            <button
              v-for="page in totalPages"
              :key="page"
              @click="changePage(page)"
              :class="[
                'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset',
                page === currentPage
                  ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 focus:z-20 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              {{ page }}
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === totalPages
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Page Modal -->
    <div v-if="showNewPageModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeNewPageModal"></div>

        <!-- Modal panel -->
        <div class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:align-middle dark:bg-blue-gray-800">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 dark:bg-blue-gray-800">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white" id="modal-title">Create New Page</h3>
                <div class="mt-6 space-y-6">
                  <div>
                    <label for="page-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="page-title"
                        v-model="newPage.title"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="page-slug" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Slug (optional)</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="page-slug"
                        v-model="newPage.slug"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="e.g. about-us (leave empty to generate from title)"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label for="page-template" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Template</label>
                      <div class="mt-1">
                        <select
                          id="page-template"
                          v-model="newPage.template"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option v-for="template in templates.filter(t => t.name !== 'All Templates')" :key="template.id" :value="template.name">{{ template.name }}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label for="page-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <div class="mt-1">
                        <select
                          id="page-status"
                          v-model="newPage.status"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option v-for="status in statuses.filter(s => s.name !== 'All Statuses')" :key="status.id" :value="status.name">{{ status.name }}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="page-sections" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Page Sections</label>
                    <div class="mt-1">
                      <div class="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-md dark:border-gray-600">
                        <div v-for="section in availableSections" :key="section" class="flex items-center">
                          <input
                            :id="`section-${section}`"
                            type="checkbox"
                            :value="section"
                            v-model="newPage.sections"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                          />
                          <label :for="`section-${section}`" class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ section }}</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Page Location</label>
                    <div class="mt-2 space-y-2">
                      <div class="flex items-center">
                        <input
                          id="homepage"
                          type="checkbox"
                          v-model="newPage.isHomepage"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                        />
                        <label for="homepage" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Set as Homepage</label>
                      </div>
                      <div class="flex items-center">
                        <input
                          id="main-menu"
                          type="checkbox"
                          v-model="newPage.inMainMenu"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                        />
                        <label for="main-menu" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Show in Main Menu</label>
                      </div>
                      <div class="flex items-center">
                        <input
                          id="footer"
                          type="checkbox"
                          v-model="newPage.inFooter"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                        />
                        <label for="footer" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Show in Footer</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">SEO Settings</label>
                    <div class="mt-2 space-y-3">
                      <div>
                        <label for="seo-title" class="block text-xs text-gray-500 dark:text-gray-400">SEO Title</label>
                        <input
                          type="text"
                          id="seo-title"
                          v-model="newPage.seo.title"
                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="Leave empty to use page title"
                        />
                      </div>
                      <div>
                        <label for="seo-description" class="block text-xs text-gray-500 dark:text-gray-400">Meta Description</label>
                        <textarea
                          id="seo-description"
                          v-model="newPage.seo.description"
                          rows="2"
                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        ></textarea>
                      </div>
                      <div>
                        <label for="seo-keywords" class="block text-xs text-gray-500 dark:text-gray-400">Meta Keywords</label>
                        <input
                          type="text"
                          id="seo-keywords"
                          v-model="newPage.seo.keywords"
                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="e.g. about, company, team"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">OG Image</label>
                    <div class="mt-1 flex items-center space-x-4">
                      <div class="h-24 w-40 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <img :src="newPage.ogImage" alt="OG Image Preview" class="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-blue-gray-600"
                      >
                        <div class="i-hugeicons-image-01 h-5 w-5 mr-1"></div>
                        Change Image
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-blue-gray-900">
            <button
              type="button"
              @click="createNewPage"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Create Page
            </button>
            <button
              type="button"
              @click="closeNewPageModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
