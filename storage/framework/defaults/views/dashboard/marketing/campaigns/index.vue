<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Marketing Campaigns',
})

// Define campaign type
interface Campaign {
  id: number
  name: string
  type: string
  status: string
  startDate: string
  endDate: string | null
  budget: number
  spent: number
  goal: string
  goalTarget: number
  goalProgress: number
  audience: string
  channels: string[]
  owner: string
  ownerAvatar: string
  createdAt: string
  lastModified: string
}

// Sample campaigns data
const campaigns = ref<Campaign[]>([
  {
    id: 1,
    name: 'Summer Sale Promotion',
    type: 'Discount',
    status: 'Active',
    startDate: '2023-06-01',
    endDate: '2023-08-31',
    budget: 5000,
    spent: 3200,
    goal: 'Sales',
    goalTarget: 50000,
    goalProgress: 32000,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website'],
    owner: 'Alex Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    createdAt: '2023-05-15',
    lastModified: '2023-07-10'
  },
  {
    id: 2,
    name: 'New Product Launch',
    type: 'Product Launch',
    status: 'Scheduled',
    startDate: '2023-09-15',
    endDate: '2023-10-15',
    budget: 10000,
    spent: 0,
    goal: 'Awareness',
    goalTarget: 100000,
    goalProgress: 0,
    audience: 'Existing Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'PR'],
    owner: 'Sarah Miller',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    createdAt: '2023-07-20',
    lastModified: '2023-07-25'
  },
  {
    id: 3,
    name: 'Holiday Season Special',
    type: 'Seasonal',
    status: 'Draft',
    startDate: '2023-11-20',
    endDate: '2023-12-31',
    budget: 8000,
    spent: 0,
    goal: 'Sales',
    goalTarget: 75000,
    goalProgress: 0,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website', 'Paid Ads'],
    owner: 'David Chen',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    createdAt: '2023-08-05',
    lastModified: '2023-08-05'
  },
  {
    id: 4,
    name: 'Customer Loyalty Program',
    type: 'Loyalty',
    status: 'Active',
    startDate: '2023-01-01',
    endDate: null,
    budget: 12000,
    spent: 7500,
    goal: 'Retention',
    goalTarget: 500,
    goalProgress: 320,
    audience: 'Existing Customers',
    channels: ['Email', 'App', 'Website'],
    owner: 'Emily Wilson',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/23.jpg',
    createdAt: '2022-12-10',
    lastModified: '2023-06-15'
  },
  {
    id: 5,
    name: 'Back to School Campaign',
    type: 'Seasonal',
    status: 'Completed',
    startDate: '2022-08-01',
    endDate: '2022-09-15',
    budget: 4500,
    spent: 4500,
    goal: 'Sales',
    goalTarget: 30000,
    goalProgress: 35200,
    audience: 'Students & Parents',
    channels: ['Email', 'Social Media', 'Paid Ads'],
    owner: 'Michael Thompson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/42.jpg',
    createdAt: '2022-07-05',
    lastModified: '2022-09-20'
  },
  {
    id: 6,
    name: 'Spring Collection Launch',
    type: 'Product Launch',
    status: 'Completed',
    startDate: '2023-03-01',
    endDate: '2023-04-15',
    budget: 7500,
    spent: 7200,
    goal: 'Sales',
    goalTarget: 45000,
    goalProgress: 42000,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website', 'PR'],
    owner: 'Jessica Lee',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/56.jpg',
    createdAt: '2023-02-10',
    lastModified: '2023-04-20'
  },
  {
    id: 7,
    name: 'App Download Promotion',
    type: 'App Promotion',
    status: 'Active',
    startDate: '2023-07-01',
    endDate: '2023-09-30',
    budget: 6000,
    spent: 2800,
    goal: 'Downloads',
    goalTarget: 10000,
    goalProgress: 6500,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'Website'],
    owner: 'Robert Garcia',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/78.jpg',
    createdAt: '2023-06-15',
    lastModified: '2023-07-25'
  },
  {
    id: 8,
    name: 'Black Friday Sale',
    type: 'Discount',
    status: 'Draft',
    startDate: '2023-11-24',
    endDate: '2023-11-27',
    budget: 15000,
    spent: 0,
    goal: 'Sales',
    goalTarget: 100000,
    goalProgress: 0,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'Website', 'PR'],
    owner: 'Sophia Martinez',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    createdAt: '2023-08-10',
    lastModified: '2023-08-10'
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('startDate')
const sortOrder = ref('desc')
const statusFilter = ref('all')
const typeFilter = ref('all')
const viewMode = ref('compact') // 'detailed' or 'compact'

// Available statuses
const statuses = ['all', 'Active', 'Scheduled', 'Draft', 'Completed']

// Available types
const types = ['all', 'Discount', 'Product Launch', 'Seasonal', 'Loyalty', 'App Promotion']

// Computed filtered and sorted campaigns
const filteredCampaigns = computed(() => {
  return campaigns.value
    .filter(campaign => {
      // Apply search filter
      const matchesSearch =
        campaign.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        campaign.owner.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || campaign.status === statusFilter.value

      // Apply type filter
      const matchesType = typeFilter.value === 'all' || campaign.type === typeFilter.value

      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'startDate') {
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      } else if (sortBy.value === 'budget') {
        comparison = a.budget - b.budget
      } else if (sortBy.value === 'goalProgress') {
        comparison = a.goalProgress - b.goalProgress
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const itemsPerPage = ref(9);
const currentPage = ref(1);

const totalPages = computed(() => {
  return Math.ceil(filteredCampaigns.value.length / itemsPerPage.value);
});

const paginatedCampaigns = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  return filteredCampaigns.value.slice(startIndex, endIndex);
});

// Pagination functions
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const goToPage = (page: number) => {
  currentPage.value = page;
};

// Calculate displayed page numbers for pagination
const displayedPages = computed(() => {
  const totalPagesToShow = 5;
  const pages: number[] = [];

  if (totalPages.value <= totalPagesToShow) {
    // If we have fewer pages than we want to show, display all pages
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i);
    }
  } else {
    // Always include first page
    pages.push(1);

    // Calculate start and end of page range around current page
    let startPage = Math.max(2, currentPage.value - 1);
    let endPage = Math.min(totalPages.value - 1, currentPage.value + 1);

    // Adjust if we're at the start or end
    if (currentPage.value <= 2) {
      endPage = 4;
    } else if (currentPage.value >= totalPages.value - 1) {
      startPage = totalPages.value - 3;
    }

    // Add ellipsis if needed before middle pages
    if (startPage > 2) {
      pages.push(-1); // -1 represents ellipsis
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis if needed after middle pages
    if (endPage < totalPages.value - 1) {
      pages.push(-2); // -2 represents ellipsis
    }

    // Always include last page
    pages.push(totalPages.value);
  }

  return pages;
});

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
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Draft':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Completed':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// Format date
function formatDate(date: string | null): string {
  if (!date) return 'Ongoing'
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Calculate progress percentage
function calculateProgress(progress: number, target: number) {
  return Math.round((progress / target) * 100);
}

// Modal state
const showCampaignModal = ref(false)
const isEditMode = ref(false)
const currentCampaign = ref<Campaign>({
  id: 0,
  name: '',
  type: 'Social Media',
  status: 'Draft',
  audience: '',
  startDate: '',
  endDate: null,
  budget: 0,
  spent: 0,
  goal: '',
  goalProgress: 0,
  goalTarget: 100,
  channels: [],
  owner: '',
  ownerAvatar: '',
  createdAt: '',
  lastModified: ''
})

const openNewCampaignModal = () => {
  // Ensure we have a string date
  const today = new Date().toISOString().split('T')[0];
  if (!today) return; // Safety check

  currentCampaign.value = {
    id: Math.max(...campaigns.value.map(c => c.id)) + 1,
    name: '',
    type: 'Social Media',
    status: 'Draft',
    audience: '',
    startDate: today,
    endDate: null,
    budget: 0,
    spent: 0,
    goal: 'Sales',
    goalProgress: 0,
    goalTarget: 100,
    channels: ['Email'],
    owner: 'Alex Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    createdAt: today,
    lastModified: today
  };

  isEditMode.value = false;
  showCampaignModal.value = true;
};

function openEditCampaignModal(campaign: Campaign): void {
  currentCampaign.value = { ...campaign }
  isEditMode.value = true
  showCampaignModal.value = true
}

function closeCampaignModal(): void {
  showCampaignModal.value = false
}

const saveCampaign = () => {
  if (!currentCampaign.value) return;

  // Ensure we have a string date
  const today = new Date().toISOString().split('T')[0];
  if (!today) return; // Safety check

  currentCampaign.value.lastModified = today;

  if (isEditMode.value) {
    // Update existing campaign
    const index = campaigns.value.findIndex(c => c.id === currentCampaign.value?.id);
    if (index !== -1) {
      campaigns.value[index] = { ...currentCampaign.value };
    }
  } else {
    // Add new campaign
    campaigns.value.push({ ...currentCampaign.value });
  }

  showCampaignModal.value = false;
};

// Delete campaign
function deleteCampaign(campaignId: number): void {
  const index = campaigns.value.findIndex(c => c.id === campaignId)
  if (index !== -1) {
    campaigns.value.splice(index, 1)
  }
}

// Calculate summary statistics
const totalActiveCampaigns = computed(() => campaigns.value.filter(c => c.status === 'Active').length)
const totalScheduledCampaigns = computed(() => campaigns.value.filter(c => c.status === 'Scheduled').length)
const totalBudget = computed(() => campaigns.value.reduce((sum, campaign) => sum + campaign.budget, 0))
const totalSpent = computed(() => campaigns.value.reduce((sum, campaign) => sum + campaign.spent, 0))
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Campaigns</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your marketing campaigns across different channels
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openNewCampaignModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Create campaign
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Active campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-play-circle h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Active Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalActiveCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Scheduled campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-calendar-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalScheduledCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Total budget card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-wallet h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Budget</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ formatCurrency(totalBudget) }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Total spent card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-orange-100 p-2 dark:bg-orange-900">
                    <div class="i-hugeicons-chart-bar-01 h-6 w-6 text-orange-600 dark:text-orange-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Spent</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ formatCurrency(totalSpent) }}</div>
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
              placeholder="Search campaigns..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
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

            <!-- Type filter -->
            <select
              v-model="typeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Types</option>
              <option v-for="type in types.slice(1)" :key="type" :value="type">
                {{ type }}
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
            @click="toggleSort('name')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'name' }"
          >
            Name
            <span v-if="sortBy === 'name'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('startDate')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'startDate' }"
          >
            Date
            <span v-if="sortBy === 'startDate'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('budget')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'budget' }"
          >
            Budget
            <span v-if="sortBy === 'budget'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('goalProgress')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'goalProgress' }"
          >
            Progress
            <span v-if="sortBy === 'goalProgress'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Compact view (table) -->
        <div v-if="viewMode === 'compact'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Campaign</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Dates</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Budget</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Progress</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedCampaigns.length === 0">
                <td colspan="7" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No campaigns found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="campaign in paginatedCampaigns" :key="campaign.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ campaign.name }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{{ campaign.audience }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ campaign.type }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(campaign.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ campaign.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>{{ formatDate(campaign.startDate) }}</div>
                  <div class="text-xs">to {{ formatDate(campaign.endDate) }}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>{{ formatCurrency(campaign.budget) }}</div>
                  <div class="text-xs">{{ formatCurrency(campaign.spent) }} spent</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mr-2">
                      <div
                        class="bg-blue-600 h-2.5 rounded-full dark:bg-blue-500"
                        :style="{ width: `${calculateProgress(campaign.goalProgress, campaign.goalTarget)}%` }"
                      ></div>
                    </div>
                    <span>{{ calculateProgress(campaign.goalProgress, campaign.goalTarget) }}%</span>
                  </div>
                  <div class="text-xs mt-1">{{ campaign.goal }}: {{ campaign.goalProgress }} / {{ campaign.goalTarget }}</div>
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      @click="openEditCampaignModal(campaign)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit</span>
                    </button>
                    <button
                      @click="deleteCampaign(campaign.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-all duration-150"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Detailed view (cards) -->
        <div v-if="viewMode === 'detailed'" class="mt-6">
          <div v-if="paginatedCampaigns.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <div class="i-hugeicons-search-magnifying-glass h-12 w-12 text-gray-400 dark:text-gray-600"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No campaigns found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="campaign in paginatedCampaigns" :key="campaign.id" class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">{{ campaign.name }}</h3>
                  <span :class="[getStatusClass(campaign.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ campaign.status }}
                  </span>
                </div>
                <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ campaign.type }}</div>
                <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ campaign.audience }}</div>

                <div class="mt-4">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Budget:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(campaign.budget) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Spent:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(campaign.spent) }}</span>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Start date:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatDate(campaign.startDate) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">End date:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatDate(campaign.endDate) }}</span>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="mb-1 flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">{{ campaign.goal }}:</span>
                    <span class="font-medium text-gray-900 dark:text-white">
                      {{ campaign.goalProgress }} / {{ campaign.goalTarget }}
                    </span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      class="bg-blue-600 h-2.5 rounded-full dark:bg-blue-500"
                      :style="{ width: `${calculateProgress(campaign.goalProgress, campaign.goalTarget)}%` }"
                    ></div>
                  </div>
                </div>

                <div class="mt-5 flex justify-end space-x-3">
                  <button
                    @click="openEditCampaignModal(campaign)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-edit-01 -ml-0.5 mr-2 h-4 w-4"></div>
                    Edit
                  </button>
                  <button
                    @click="deleteCampaign(campaign.id)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-waste -ml-0.5 mr-2 h-4 w-4"></div>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-blue-gray-800 sm:px-6">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
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
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredCampaigns.length) }}</span>
                of
                <span class="font-medium">{{ filteredCampaigns.length }}</span>
                results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="prevPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-500 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-chevron-left h-5 w-5"></div>
                </button>
                <button
                  v-for="page in displayedPages"
                  :key="page"
                  @click="goToPage(page)"
                  :class="[
                    page === currentPage
                      ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                      : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-700',
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-500 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-chevron-right h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Campaign Modal -->
    <div v-if="showCampaignModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
        </div>

        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-blue-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              @click="showCampaignModal = false"
              type="button"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-x-mark h-6 w-6"></div>
            </button>
          </div>

          <div class="sm:flex sm:items-start">
            <div class="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                {{ isEditMode ? 'Edit Campaign' : 'Create New Campaign' }}
              </h3>
              <div class="mt-6">
                <form @submit.prevent="saveCampaign">
                  <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div class="sm:col-span-6">
                      <label for="campaign-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Campaign Name
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-name"
                          v-model="currentCampaign.name"
                          type="text"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Type
                      </label>
                      <div class="mt-1">
                        <select
                          id="campaign-type"
                          v-model="currentCampaign.type"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        >
                          <option value="Social Media">Social Media</option>
                          <option value="Email">Email</option>
                          <option value="Content">Content</option>
                          <option value="PPC">PPC</option>
                          <option value="SEO">SEO</option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </label>
                      <div class="mt-1">
                        <select
                          id="campaign-status"
                          v-model="currentCampaign.status"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        >
                          <option value="Draft">Draft</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Active">Active</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-6">
                      <label for="campaign-audience" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Target Audience
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-audience"
                          v-model="currentCampaign.audience"
                          type="text"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-start-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Date
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-start-date"
                          v-model="currentCampaign.startDate"
                          type="date"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-end-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        End Date
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-end-date"
                          v-model="currentCampaign.endDate"
                          type="date"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-budget" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Budget
                      </label>
                      <div class="mt-1 relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          id="campaign-budget"
                          v-model.number="currentCampaign.budget"
                          type="number"
                          min="0"
                          step="0.01"
                          class="block w-full rounded-md border-gray-300 pl-7 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-spent" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Spent
                      </label>
                      <div class="mt-1 relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          id="campaign-spent"
                          v-model.number="currentCampaign.spent"
                          type="number"
                          min="0"
                          step="0.01"
                          class="block w-full rounded-md border-gray-300 pl-7 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-6">
                      <label for="campaign-goal" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Goal
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-goal"
                          v-model="currentCampaign.goal"
                          type="text"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-goal-progress" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Progress
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-goal-progress"
                          v-model.number="currentCampaign.goalProgress"
                          type="number"
                          min="0"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-goal-target" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Target
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-goal-target"
                          v-model.number="currentCampaign.goalTarget"
                          type="number"
                          min="1"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600 sm:col-start-2 sm:text-sm"
                    >
                      {{ isEditMode ? 'Save Changes' : 'Create Campaign' }}
                    </button>
                    <button
                      type="button"
                      @click="showCampaignModal = false"
                      class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600 sm:col-start-1 sm:mt-0 sm:text-sm"
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
