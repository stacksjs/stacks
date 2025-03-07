<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Events & Goals',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface Event {
  id: string
  name: string
  completions: number
  value: number
  conversionRate: number
  status: 'active' | 'blocked'
  createdAt: string
  lastTriggered: string
}

interface EventData {
  date: string
  completions: number
  value: number
}

interface ComparisonData {
  current: {
    completions: number
    conversionRate: number
    value: number
  }
  previous: {
    completions: number
    conversionRate: number
    value: number
  }
  percentageChange: {
    completions: number
    conversionRate: number
    value: number
  }
}

// Date range options
const dateRanges: DateRange[] = [
  { id: 'last7days', name: 'Last 7 Days' },
  { id: 'last30days', name: 'Last 30 Days' },
  { id: 'thisMonth', name: 'This Month' },
  { id: 'lastMonth', name: 'Last Month' },
  { id: 'thisYear', name: 'This Year' },
  { id: 'custom', name: 'Custom Range' }
]

// Selected date range
const selectedDateRange = ref('last30days')
const dateRangeDisplay = ref('Last 30 Days: Feb 5, 2024 to Mar 6, 2024')
const comparisonType = ref('no-comparison')
const customStartDate = ref('')
const customEndDate = ref('')
const showCustomDateRange = computed(() => selectedDateRange.value === 'custom')
const isDateRangeOpen = ref(false)

// Comparison data
const comparisonData = ref<Record<string, ComparisonData>>({})
const isComparing = computed(() => comparisonType.value !== 'no-comparison')
const comparisonLabel = computed(() => {
  if (comparisonType.value === 'previous-period') return 'vs Previous Period'
  if (comparisonType.value === 'previous-year') return 'vs Previous Year'
  return ''
})

// Auto date range
const isAutoDateRange = ref(true)

// Conversion calculation type
const conversionCalculationType = ref('pageviews') // 'pageviews' or 'people'

// Events data
const events = ref<Event[]>([
  {
    id: '1',
    name: 'Newsletter Signup',
    completions: 342,
    value: 0,
    conversionRate: 15.5,
    status: 'active',
    createdAt: '2023-11-15',
    lastTriggered: '2024-03-05'
  },
  {
    id: '2',
    name: 'Free Trial Started',
    completions: 128,
    value: 0,
    conversionRate: 5.8,
    status: 'active',
    createdAt: '2023-11-20',
    lastTriggered: '2024-03-06'
  },
  {
    id: '3',
    name: 'Purchase Completed',
    completions: 87,
    value: 8700,
    conversionRate: 3.9,
    status: 'active',
    createdAt: '2023-12-01',
    lastTriggered: '2024-03-06'
  },
  {
    id: '4',
    name: 'Contact Form Submitted',
    completions: 215,
    value: 0,
    conversionRate: 9.8,
    status: 'active',
    createdAt: '2023-12-05',
    lastTriggered: '2024-03-05'
  },
  {
    id: '5',
    name: 'Documentation Downloaded',
    completions: 156,
    value: 0,
    conversionRate: 7.1,
    status: 'active',
    createdAt: '2024-01-10',
    lastTriggered: '2024-03-04'
  },
  {
    id: '6',
    name: 'Checkout Started',
    completions: 203,
    value: 0,
    conversionRate: 9.2,
    status: 'active',
    createdAt: '2024-01-15',
    lastTriggered: '2024-03-06'
  },
  {
    id: '7',
    name: '404: /old-page',
    completions: 42,
    value: 0,
    conversionRate: 1.9,
    status: 'blocked',
    createdAt: '2024-02-01',
    lastTriggered: '2024-02-28'
  }
])

// Blocked events
const blockedEvents = computed(() => events.value.filter(event => event.status === 'blocked'))
const activeEvents = computed(() => events.value.filter(event => event.status === 'active'))

// Event data for chart
const eventChartData = ref<Record<string, EventData[]>>({
  '1': [
    { date: '2024-03-01', completions: 12, value: 0 },
    { date: '2024-03-02', completions: 15, value: 0 },
    { date: '2024-03-03', completions: 10, value: 0 },
    { date: '2024-03-04', completions: 18, value: 0 },
    { date: '2024-03-05', completions: 22, value: 0 },
    { date: '2024-03-06', completions: 14, value: 0 }
  ],
  '2': [
    { date: '2024-03-01', completions: 5, value: 0 },
    { date: '2024-03-02', completions: 7, value: 0 },
    { date: '2024-03-03', completions: 4, value: 0 },
    { date: '2024-03-04', completions: 6, value: 0 },
    { date: '2024-03-05', completions: 8, value: 0 },
    { date: '2024-03-06', completions: 5, value: 0 }
  ],
  '3': [
    { date: '2024-03-01', completions: 3, value: 300 },
    { date: '2024-03-02', completions: 5, value: 500 },
    { date: '2024-03-03', completions: 2, value: 200 },
    { date: '2024-03-04', completions: 4, value: 400 },
    { date: '2024-03-05', completions: 6, value: 600 },
    { date: '2024-03-06', completions: 4, value: 400 }
  ]
})

// Selected event for detailed view
const selectedEvent = ref<Event | null>(null)
const showEventDetails = ref(false)
const showCreateEventModal = ref(false)
const showDeleteConfirmModal = ref(false)
const eventToDelete = ref<Event | null>(null)

// New event form
const newEvent = reactive({
  name: '',
  hasValue: false,
  currency: 'USD'
})

// Chart.js configuration
let eventChart: Chart | null = null

function createEventChart(eventId: string) {
  const ctx = document.getElementById('eventChart') as HTMLCanvasElement
  if (!ctx) return

  const chartData = eventChartData.value[eventId] || []

  const datasets = [
    {
      label: 'Completions',
      data: chartData.map(item => item.completions),
      backgroundColor: 'rgba(59, 130, 246, 0.3)',
      borderColor: 'rgba(59, 130, 246, 0.8)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    }
  ]

  // Add comparison dataset if comparing
  if (isComparing.value && comparisonData.value[eventId]) {
    // Create a dataset with values that are 20-40% lower for demonstration
    const comparisonDataset = {
      label: comparisonLabel.value,
      data: chartData.map(item => Math.round(item.completions * (0.6 + Math.random() * 0.2))),
      backgroundColor: 'rgba(156, 163, 175, 0.2)',
      borderColor: 'rgba(156, 163, 175, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.4,
      fill: false
    }

    datasets.push(comparisonDataset)
  }

  const chartConfig = {
    type: 'line' as keyof ChartTypeRegistry,
    data: {
      labels: chartData.map(item => {
        const date = new Date(item.date)
        return `${date.getMonth() + 1}/${date.getDate()}`
      }),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            borderDash: [2, 4],
            color: 'rgba(160, 174, 192, 0.2)'
          },
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: isComparing.value,
          position: 'top' as const
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false
        }
      }
    }
  }

  if (eventChart) {
    eventChart.destroy()
  }

  eventChart = new Chart(ctx, chartConfig)
}

// Utility functions
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatCurrency(value: number, currency: string = 'USD'): string {
  if (value === 0) return '-'

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  })

  return formatter.format(value / 100) // Convert cents to dollars
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatPercentageChange(value: number): string {
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function getPercentageChangeClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-600 dark:text-gray-400'
}

// Event handlers
function viewEventDetails(event: Event) {
  selectedEvent.value = event
  showEventDetails.value = true

  // Create chart in next tick to ensure DOM is ready
  setTimeout(() => {
    createEventChart(event.id)
  }, 100)
}

function closeEventDetails() {
  showEventDetails.value = false
  selectedEvent.value = null
  if (eventChart) {
    eventChart.destroy()
    eventChart = null
  }
}

function openCreateEventModal() {
  showCreateEventModal.value = true
}

function closeCreateEventModal() {
  showCreateEventModal.value = false
  // Reset form
  newEvent.name = ''
  newEvent.hasValue = false
  newEvent.currency = 'USD'
}

function createNewEvent() {
  // In a real app, this would send data to the server
  const newId = (Math.max(...events.value.map(e => parseInt(e.id))) + 1).toString()

  events.value.push({
    id: newId,
    name: newEvent.name,
    completions: 0,
    value: 0,
    conversionRate: 0,
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0],
    lastTriggered: '-'
  })

  closeCreateEventModal()
}

function confirmDeleteEvent(event: Event) {
  eventToDelete.value = event
  showDeleteConfirmModal.value = true
}

function cancelDeleteEvent() {
  eventToDelete.value = null
  showDeleteConfirmModal.value = false
}

function deleteEvent() {
  if (!eventToDelete.value) return

  // Type assertion to tell TypeScript that eventToDelete.value is definitely an Event
  const event = eventToDelete.value as Event
  const eventId = event.id

  if (event.status === 'active') {
    // Block the event instead of deleting
    const eventIndex = events.value.findIndex(e => e.id === eventId)
    if (eventIndex !== -1) {
      events.value[eventIndex].status = 'blocked'
    }
  } else {
    // Remove completely if already blocked
    events.value = events.value.filter(e => e.id !== eventId)
  }

  // Close modals
  showDeleteConfirmModal.value = false
  if (showEventDetails.value && selectedEvent.value?.id === eventId) {
    closeEventDetails()
  }
  eventToDelete.value = null
}

function unblockEvent(eventId: string) {
  const eventIndex = events.value.findIndex(e => e.id === eventId)
  if (eventIndex !== -1) {
    events.value[eventIndex].status = 'active'
  }
}

function updateConversionCalculationType() {
  // In a real app, this would update the server setting
  console.log('Conversion calculation type updated to:', conversionCalculationType.value)
}

function updateDataForDateRange(): void {
  // In a real app, this would fetch data from the server based on the selected date range
  console.log('Updating data for date range:', selectedDateRange.value)
  console.log('Comparison type:', comparisonType.value)

  // Update date range display
  if (selectedDateRange.value === 'last7days') {
    dateRangeDisplay.value = 'Last 7 Days: Feb 28, 2024 to Mar 6, 2024'
  } else if (selectedDateRange.value === 'last30days') {
    dateRangeDisplay.value = 'Last 30 Days: Feb 5, 2024 to Mar 6, 2024'
  } else if (selectedDateRange.value === 'thisMonth') {
    dateRangeDisplay.value = 'This Month: Mar 1, 2024 to Mar 6, 2024'
  } else if (selectedDateRange.value === 'lastMonth') {
    dateRangeDisplay.value = 'Last Month: Feb 1, 2024 to Feb 29, 2024'
  } else if (selectedDateRange.value === 'thisYear') {
    dateRangeDisplay.value = 'This Year: Jan 1, 2024 to Mar 6, 2024'
  } else if (selectedDateRange.value === 'custom' && customStartDate.value && customEndDate.value) {
    const start = formatDate(customStartDate.value)
    const end = formatDate(customEndDate.value)
    dateRangeDisplay.value = `Custom Range: ${start} to ${end}`
  } else {
    dateRangeDisplay.value = 'All Time: Sep 7, 2023 to Mar 6, 2024'
  }

  // Generate comparison data if needed
  if (comparisonType.value !== 'no-comparison') {
    generateComparisonData()
  } else {
    comparisonData.value = {}
  }
}

// Generate mock comparison data
function generateComparisonData(): void {
  // In a real app, this would be fetched from the server
  events.value.forEach(event => {
    // Generate random percentage changes between -30% and +50%
    const completionsChange = Math.floor(Math.random() * 80) - 30
    const conversionRateChange = Math.floor(Math.random() * 80) - 30
    const valueChange = Math.floor(Math.random() * 80) - 30

    // Calculate previous period values based on current values and percentage changes
    const previousCompletions = Math.round(event.completions / (1 + completionsChange / 100))
    const previousConversionRate = +(event.conversionRate / (1 + conversionRateChange / 100)).toFixed(1)
    const previousValue = Math.round(event.value / (1 + valueChange / 100))

    comparisonData.value[event.id] = {
      current: {
        completions: event.completions,
        conversionRate: event.conversionRate,
        value: event.value
      },
      previous: {
        completions: previousCompletions,
        conversionRate: previousConversionRate,
        value: previousValue
      },
      percentageChange: {
        completions: completionsChange,
        conversionRate: conversionRateChange,
        value: valueChange
      }
    }
  })
}

// Toggle auto date range
function toggleAutoDateRange(): void {
  isAutoDateRange.value = !isAutoDateRange.value

  if (isAutoDateRange.value) {
    // Set to last 30 days when auto is enabled
    selectedDateRange.value = 'last30days'
    updateDataForDateRange()
  }
}

// Handle date range change
function handleDateRangeChange(): void {
  // Disable auto when manually changing date range
  if (isAutoDateRange.value) {
    isAutoDateRange.value = false
  }

  updateDataForDateRange()
}

// Handle comparison type change
function handleComparisonTypeChange(): void {
  updateDataForDateRange()
}

// Initialize when component is mounted
onMounted(() => {
  // In a real app, this would fetch data from the server
  console.log('Events component mounted')
  updateDataForDateRange()
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header with date range selector -->
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center space-x-2">
            <div class="i-hugeicons-calendar-03 h-5 w-5 text-gray-500 dark:text-gray-400"></div>
            <div class="relative">
              <button
                type="button"
                class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center"
                @click="isDateRangeOpen = !isDateRangeOpen"
              >
                {{ dateRangeDisplay }}
                <div class="i-hugeicons-arrow-down-01 h-4 w-4 ml-1"></div>
              </button>

              <!-- Date range dropdown -->
              <div
                v-if="isDateRangeOpen"
                class="absolute left-0 z-10 mt-2 w-72 origin-top-left rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none dark:bg-blue-gray-800 dark:ring-gray-700"
              >
                <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">Select Date Range</h3>
                </div>

                <div class="py-2">
                  <div
                    v-for="range in dateRanges"
                    :key="range.id"
                    class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 cursor-pointer"
                    :class="{ 'bg-gray-50 dark:bg-blue-gray-700': selectedDateRange === range.id }"
                    @click="selectedDateRange = range.id; handleDateRangeChange(); isDateRangeOpen = false"
                  >
                    {{ range.name }}
                  </div>

                  <div
                    class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-700 cursor-pointer"
                    :class="{ 'bg-gray-50 dark:bg-blue-gray-700': selectedDateRange === 'all-time' }"
                    @click="selectedDateRange = 'all-time'; handleDateRangeChange(); isDateRangeOpen = false"
                  >
                    All Time
                  </div>
                </div>

                <!-- Custom date range -->
                <div v-if="selectedDateRange === 'custom'" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                  <div class="flex flex-col space-y-2">
                    <div>
                      <label for="customStartDate" class="block text-xs font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                      <input
                        type="date"
                        id="customStartDate"
                        v-model="customStartDate"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label for="customEndDate" class="block text-xs font-medium text-gray-700 dark:text-gray-300">End Date</label>
                      <input
                        type="date"
                        id="customEndDate"
                        v-model="customEndDate"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <button
                      type="button"
                      class="mt-2 w-full inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      @click="handleDateRangeChange(); isDateRangeOpen = false"
                      :disabled="!customStartDate || !customEndDate"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">compared to</span>

            <div class="relative">
              <select
                v-model="comparisonType"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                @change="handleComparisonTypeChange"
              >
                <option value="no-comparison">No comparison</option>
                <option value="previous-period">Previous period</option>
                <option value="previous-year">Previous year</option>
              </select>
            </div>

            <button
              type="button"
              class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset hover:bg-gray-50 dark:hover:bg-blue-gray-600"
              :class="isAutoDateRange ?
                'bg-blue-600 text-white ring-blue-600 dark:bg-blue-600 dark:text-white dark:ring-blue-500' :
                'bg-white text-gray-900 ring-gray-300 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600'"
              @click="toggleAutoDateRange"
            >
              <div class="i-hugeicons-settings-01 h-4 w-4 mr-1"></div>
              Auto
            </button>
          </div>
        </div>

        <!-- Events Overview -->
        <div class="mb-8">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Events & Goals</h2>

            <div class="mt-2 sm:mt-0 flex items-center space-x-2">
              <button
                @click="openCreateEventModal"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <div class="i-hugeicons-plus-sign h-4 w-4 mr-1"></div>
                Create Event
              </button>
            </div>
          </div>

          <!-- Conversion calculation type selector -->
          <div class="mb-6 bg-gray-50 dark:bg-blue-gray-800 p-4 rounded-lg">
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Calculate conversion rates using:</span>

              <div class="flex items-center space-x-4">
                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    v-model="conversionCalculationType"
                    value="pageviews"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    @change="updateConversionCalculationType"
                  >
                  <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Page views</span>
                </label>

                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    v-model="conversionCalculationType"
                    value="people"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    @change="updateConversionCalculationType"
                  >
                  <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">People</span>
                </label>
              </div>

              <div class="text-xs text-gray-500 dark:text-gray-400">
                <span v-if="conversionCalculationType === 'pageviews'">
                  Formula: Event completions / total Page views
                </span>
                <span v-else>
                  Formula: Event completions / total People
                </span>
              </div>
            </div>
          </div>

          <!-- Events Table -->
          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-blue-gray-800">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Event Name
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Completions
                    <span v-if="isComparing" class="block text-[10px] font-normal normal-case">{{ comparisonLabel }}</span>
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Value
                    <span v-if="isComparing" class="block text-[10px] font-normal normal-case">{{ comparisonLabel }}</span>
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Conversion Rate
                    <span v-if="isComparing" class="block text-[10px] font-normal normal-case">{{ comparisonLabel }}</span>
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Last Triggered
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="event in activeEvents"
                  :key="event.id"
                  class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 cursor-pointer"
                  @click="viewEventDetails(event)"
                >
                  <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {{ event.name }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    <div>{{ formatNumber(event.completions) }}</div>
                    <div v-if="isComparing && comparisonData[event.id]" class="text-xs" :class="getPercentageChangeClass(comparisonData[event.id].percentageChange.completions)">
                      {{ formatPercentageChange(comparisonData[event.id].percentageChange.completions) }}
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    <div>{{ formatCurrency(event.value) }}</div>
                    <div v-if="isComparing && comparisonData[event.id] && event.value > 0" class="text-xs" :class="getPercentageChangeClass(comparisonData[event.id].percentageChange.value)">
                      {{ formatPercentageChange(comparisonData[event.id].percentageChange.value) }}
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    <div>{{ event.conversionRate }}%</div>
                    <div v-if="isComparing && comparisonData[event.id]" class="text-xs" :class="getPercentageChangeClass(comparisonData[event.id].percentageChange.conversionRate)">
                      {{ formatPercentageChange(comparisonData[event.id].percentageChange.conversionRate) }}
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    {{ event.lastTriggered === '-' ? '-' : formatDate(event.lastTriggered) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    <button
                      @click.stop="confirmDeleteEvent(event)"
                      class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <div class="i-hugeicons-waste h-4 w-4"></div>
                    </button>
                  </td>
                </tr>

                <!-- Empty state -->
                <tr v-if="activeEvents.length === 0">
                  <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    <div class="flex flex-col items-center justify-center">
                      <div class="i-hugeicons-chart-01 h-12 w-12 text-gray-300 dark:text-gray-600 mb-2"></div>
                      <p class="mb-1">No events found</p>
                      <p class="text-xs">Create your first event to start tracking conversions</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Implementation Guide -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-6 shadow">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Event Implementation Guide</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Learn how to track events and conversions on your website
            </p>
          </div>

          <div class="space-y-6">
            <!-- Basic Implementation -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Basic Event Tracking</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>// Track a simple event
stacks.trackEvent('newsletter signup');</code></pre>
              </div>
            </div>

            <!-- With Value -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Track Events with Value</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>// Track an event with monetary value (in cents)
stacks.trackEvent('purchase completed', {
  _value: 1000, // $10.00
});</code></pre>
              </div>
            </div>

            <!-- Link Clicks -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Track Link Clicks</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>// Method 1: Using onclick attribute
&lt;a href="/about" onclick="stacks.trackEvent('about link click');"&gt;About Us&lt;/a&gt;

// Method 2: Using JavaScript
&lt;script&gt;
window.addEventListener('load', (event) => {
  document.getElementById('about-link').addEventListener('click', () => {
    stacks.trackEvent('about link click');
  });
});
&lt;/script&gt;</code></pre>
              </div>
            </div>

            <!-- Form Submissions -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Track Form Submissions</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>// Method 1: Using onsubmit attribute
&lt;form method="post" onsubmit="stacks.trackEvent('form submitted');"&gt;
  &lt;!-- form fields --&gt;
&lt;/form&gt;

// Method 2: Using JavaScript
&lt;script&gt;
window.addEventListener('load', (event) => {
  document.getElementById('contact-form').addEventListener('submit', () => {
    stacks.trackEvent('form submitted');
  });
});
&lt;/script&gt;</code></pre>
              </div>
            </div>

            <!-- Page Load Events -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Track Page Load Conversions</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>&lt;script&gt;
window.addEventListener('load', (event) => {
  // Fire event when thank-you page loads
  stacks.trackEvent('purchase completed');
});
&lt;/script&gt;</code></pre>
              </div>
            </div>

            <!-- 404 Pages -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Track 404 Error Pages</h4>
              <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                <pre class="text-sm"><code>&lt;script&gt;
window.addEventListener('load', () => {
  const path = window.location.pathname;
  stacks.trackEvent('404: ' + path);
});
&lt;/script&gt;</code></pre>
              </div>
            </div>
          </div>

          <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>For more detailed implementation guides and examples, refer to the <a href="#" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">documentation</a>.</p>
          </div>
        </div>

        <!-- Blocked Events Section -->
        <div v-if="blockedEvents.length > 0" class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Blocked Events</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-blue-gray-800">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Event Name
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Completions
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Created
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="event in blockedEvents"
                  :key="event.id"
                  class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50"
                >
                  <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                    <div class="flex items-center">
                      <div class="i-hugeicons-blocked h-4 w-4 mr-2 text-red-500"></div>
                      {{ event.name }}
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    {{ formatNumber(event.completions) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    {{ formatDate(event.createdAt) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <div class="flex justify-end space-x-2">
                      <button
                        @click="unblockEvent(event.id)"
                        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Unblock
                      </button>
                      <button
                        @click="confirmDeleteEvent(event)"
                        class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Event Details Modal -->
        <div v-if="showEventDetails" class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEventDetails"></div>

            <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
              <div class="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                  @click="closeEventDetails"
                >
                  <span class="sr-only">Close</span>
                  <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
                </button>
              </div>

              <div v-if="selectedEvent">
                <div class="mb-6">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ selectedEvent.name }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Created on {{ formatDate(selectedEvent.createdAt) }}
                  </p>
                </div>

                <!-- Event Stats -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div class="bg-gray-50 dark:bg-blue-gray-700 p-4 rounded-lg">
                    <div class="text-sm text-gray-500 dark:text-gray-400">Completions</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatNumber(selectedEvent.completions) }}</div>
                    <div v-if="isComparing && comparisonData[selectedEvent.id]" class="mt-1 text-sm" :class="getPercentageChangeClass(comparisonData[selectedEvent.id].percentageChange.completions)">
                      {{ formatPercentageChange(comparisonData[selectedEvent.id].percentageChange.completions) }} {{ comparisonLabel }}
                    </div>
                  </div>

                  <div class="bg-gray-50 dark:bg-blue-gray-700 p-4 rounded-lg">
                    <div class="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedEvent.conversionRate }}%</div>
                    <div v-if="isComparing && comparisonData[selectedEvent.id]" class="mt-1 text-sm" :class="getPercentageChangeClass(comparisonData[selectedEvent.id].percentageChange.conversionRate)">
                      {{ formatPercentageChange(comparisonData[selectedEvent.id].percentageChange.conversionRate) }} {{ comparisonLabel }}
                    </div>
                  </div>

                  <div class="bg-gray-50 dark:bg-blue-gray-700 p-4 rounded-lg">
                    <div class="text-sm text-gray-500 dark:text-gray-400">Value</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(selectedEvent.value) }}</div>
                    <div v-if="isComparing && comparisonData[selectedEvent.id] && selectedEvent.value > 0" class="mt-1 text-sm" :class="getPercentageChangeClass(comparisonData[selectedEvent.id].percentageChange.value)">
                      {{ formatPercentageChange(comparisonData[selectedEvent.id].percentageChange.value) }} {{ comparisonLabel }}
                    </div>
                  </div>
                </div>

                <!-- Event Chart -->
                <div class="mb-6 bg-white dark:bg-blue-gray-700 rounded-lg p-4 shadow">
                  <div class="mb-2 flex justify-between items-center">
                    <h4 class="text-md font-medium text-gray-900 dark:text-white">Recent Activity</h4>
                    <div v-if="isComparing" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ comparisonLabel }}
                    </div>
                  </div>
                  <div class="h-64 w-full">
                    <canvas id="eventChart"></canvas>
                  </div>
                </div>

                <!-- Event Code Examples -->
                <div class="mb-6">
                  <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Implementation Code</h4>

                  <div class="bg-gray-800 rounded-lg p-4 text-white overflow-x-auto">
                    <pre class="text-sm"><code>// Basic event tracking
stacks.trackEvent('{{ selectedEvent.name }}');

// With value (for e-commerce)
stacks.trackEvent('{{ selectedEvent.name }}', {
  _value: 1000, // Value in cents
});</code></pre>
                  </div>
                </div>

                <div class="mt-6 flex justify-end">
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600 mr-2"
                    @click="closeEventDetails"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                    @click="confirmDeleteEvent(selectedEvent)"
                  >
                    Delete Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Create Event Modal -->
        <div v-if="showCreateEventModal" class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeCreateEventModal"></div>

            <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  class="rounded-md bg-white dark:bg-blue-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                  @click="closeCreateEventModal"
                >
                  <span class="sr-only">Close</span>
                  <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
                </button>
              </div>

              <div>
                <div class="mb-6">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    Create New Event
                  </h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Set up a new event to track conversions on your site
                  </p>
                </div>

                <form @submit.prevent="createNewEvent">
                  <div class="mb-4">
                    <label for="eventName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Event Name
                    </label>
                    <input
                      type="text"
                      id="eventName"
                      v-model="newEvent.name"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      placeholder="e.g., Newsletter Signup"
                      required
                    />
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Use a descriptive name without special characters or emojis
                    </p>
                  </div>

                  <div class="mb-4">
                    <div class="flex items-center">
                      <input
                        id="hasValue"
                        type="checkbox"
                        v-model="newEvent.hasValue"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                      <label for="hasValue" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        This event has a monetary value (e.g., purchase)
                      </label>
                    </div>
                  </div>

                  <div class="mb-6" v-if="newEvent.hasValue">
                    <label for="currency" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <select
                      id="currency"
                      v-model="newEvent.currency"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                    </select>
                  </div>

                  <div class="mt-6 flex justify-end">
                    <button
                      type="button"
                      class="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600 mr-2"
                      @click="closeCreateEventModal"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      :disabled="!newEvent.name"
                    >
                      Create Event
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="showDeleteConfirmModal" class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="cancelDeleteEvent"></div>

            <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div>
                <div class="mb-6">
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <div class="i-hugeicons-alert-02 h-6 w-6 text-red-600 dark:text-red-400"></div>
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                      {{ eventToDelete?.status === 'active' ? 'Block Event' : 'Delete Event' }}
                    </h3>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ eventToDelete?.status === 'active'
                          ? `Are you sure you want to block "${eventToDelete?.name}"? This will prevent data collection for this event in the future.`
                          : `Are you sure you want to permanently delete "${eventToDelete?.name}"? This action cannot be undone.`
                        }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="mt-6 flex justify-end">
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600 mr-2"
                    @click="cancelDeleteEvent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                    @click="deleteEvent"
                  >
                    {{ eventToDelete?.status === 'active' ? 'Block Event' : 'Delete Event' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
