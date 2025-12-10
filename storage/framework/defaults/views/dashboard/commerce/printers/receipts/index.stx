<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Printer Logs - Analytics',
})

// Sample data for the prints dashboard
const prints = [
  { id: 1, printer: 'Checkout-1', document: 'Receipt #5432', timestamp: '2023-12-01 14:32:45', status: 'Success', size: '8.5KB', pages: 1, duration: '1.2s' },
  { id: 2, printer: 'Checkout-2', document: 'Receipt #5431', timestamp: '2023-12-01 14:30:12', status: 'Success', size: '9.1KB', pages: 1, duration: '1.3s' },
  { id: 3, printer: 'Kitchen-1', document: 'Order #5430', timestamp: '2023-12-01 14:28:55', status: 'Failed', size: '12.3KB', pages: 2, duration: '0.0s' },
  { id: 4, printer: 'Checkout-3', document: 'Receipt #5429', timestamp: '2023-12-01 14:25:33', status: 'Success', size: '8.7KB', pages: 1, duration: '1.1s' },
  { id: 5, printer: 'Pickup-1', document: 'Pickup #5428', timestamp: '2023-12-01 14:22:18', status: 'Success', size: '10.2KB', pages: 1, duration: '1.4s' },
  { id: 6, printer: 'Kitchen-1', document: 'Order #5427', timestamp: '2023-12-01 14:20:05', status: 'Success', size: '11.8KB', pages: 2, duration: '2.1s' },
  { id: 7, printer: 'Checkout-1', document: 'Receipt #5426', timestamp: '2023-12-01 14:18:42', status: 'Success', size: '8.3KB', pages: 1, duration: '1.2s' },
  { id: 8, printer: 'Kitchen-2', document: 'Order #5425', timestamp: '2023-12-01 14:15:30', status: 'Warning', size: '12.5KB', pages: 2, duration: '3.5s' },
  { id: 9, printer: 'Checkout-4', document: 'Receipt #5424', timestamp: '2023-12-01 14:12:22', status: 'Success', size: '8.9KB', pages: 1, duration: '1.3s' },
  { id: 10, printer: 'Checkout-2', document: 'Receipt #5423', timestamp: '2023-12-01 14:10:15', status: 'Success', size: '9.0KB', pages: 1, duration: '1.2s' },
  { id: 11, printer: 'Kitchen-1', document: 'Order #5422', timestamp: '2023-12-01 14:08:03', status: 'Success', size: '11.7KB', pages: 2, duration: '2.0s' },
  { id: 12, printer: 'Checkout-3', document: 'Receipt #5421', timestamp: '2023-12-01 14:05:48', status: 'Success', size: '8.6KB', pages: 1, duration: '1.1s' },
  { id: 13, printer: 'Pickup-1', document: 'Pickup #5420', timestamp: '2023-12-01 14:02:35', status: 'Failed', size: '10.1KB', pages: 1, duration: '0.0s' },
  { id: 14, printer: 'Kitchen-2', document: 'Order #5419', timestamp: '2023-12-01 14:00:20', status: 'Success', size: '12.0KB', pages: 2, duration: '2.2s' },
  { id: 15, printer: 'Checkout-1', document: 'Receipt #5418', timestamp: '2023-12-01 13:58:05', status: 'Success', size: '8.4KB', pages: 1, duration: '1.2s' },
]

// Print volume data by hour
const hourlyPrintData = {
  labels: ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM'],
  datasets: [
    {
      label: 'Print Volume',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
      fill: true,
      tension: 0.4,
      data: [25, 38, 45, 56, 48, 52, 45, 42, 38, 30, 22, 15],
    },
  ],
}

// Print volume by printer
const printerVolumeData = {
  labels: ['Checkout-1', 'Checkout-2', 'Checkout-3', 'Checkout-4', 'Kitchen-1', 'Kitchen-2', 'Pickup-1'],
  datasets: [
    {
      label: 'Print Count',
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgba(16, 185, 129, 1)',
      borderWidth: 1,
      borderRadius: 4,
      data: [120, 105, 95, 85, 150, 130, 70],
    },
  ],
}

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

// Filter options
const printerFilter = ref('All Printers')
const statusFilter = ref('All Statuses')
const dateFilter = ref('Today')

const printers = ['All Printers', 'Checkout-1', 'Checkout-2', 'Checkout-3', 'Checkout-4', 'Kitchen-1', 'Kitchen-2', 'Pickup-1']
const statuses = ['All Statuses', 'Success', 'Warning', 'Failed']
const dateRanges = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'This month', 'Last month']

// Computed filtered prints
const filteredPrints = computed(() => {
  return prints.filter(print => {
    const printerMatch = printerFilter.value === 'All Printers' || print.printer === printerFilter.value
    const statusMatch = statusFilter.value === 'All Statuses' || print.status === statusFilter.value
    return printerMatch && statusMatch
  })
})

// Stats summary
const totalPrints = 755
const successfulPrints = 732
const failedPrints = 15
const warningPrints = 8
const successRate = ((successfulPrints / totalPrints) * 100).toFixed(1)
const averagePrintTime = '1.4s'
const totalPages = 1105
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Print Logs</h1>

          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            View and analyze all print jobs across your receipt printers
          </p>

          <!-- Stats -->
          <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Print Jobs</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalPrints }}</dd>
              <dd class="mt-2 flex items-center text-sm">
                <span class="text-green-600 dark:text-green-400">{{ successfulPrints }} Successful</span>
                <span class="mx-2 text-gray-500 dark:text-gray-400">•</span>
                <span class="text-red-600 dark:text-red-400">{{ failedPrints }} Failed</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Success Rate</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ successRate }}%</dd>
              <dd class="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>{{ warningPrints }} prints with warnings</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Pages</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalPages }}</dd>
              <dd class="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>Avg. {{ (totalPages / totalPrints).toFixed(1) }} pages per print</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Average Print Time</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ averagePrintTime }}</dd>
              <dd class="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>For successful prints</span>
              </dd>
            </div>
          </dl>

          <!-- Charts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Hourly Print Volume</h3>
                <div class="mt-2 h-64">
                  <Line :data="hourlyPrintData" :options="chartOptions" />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Print Volume by Printer</h3>
                <div class="mt-2 h-64">
                  <Bar :data="printerVolumeData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="mt-8 flex flex-wrap gap-4">
            <div class="w-full sm:w-auto">
              <label for="printer-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Printer</label>
              <select
                id="printer-filter"
                v-model="printerFilter"
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
              >
                <option v-for="printer in printers" :key="printer" :value="printer">{{ printer }}</option>
              </select>
            </div>
            <div class="w-full sm:w-auto">
              <label for="status-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                id="status-filter"
                v-model="statusFilter"
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
              >
                <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
              </select>
            </div>
            <div class="w-full sm:w-auto">
              <label for="date-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
              <select
                id="date-filter"
                v-model="dateFilter"
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
              >
                <option v-for="range in dateRanges" :key="range" :value="range">{{ range }}</option>
              </select>
            </div>
          </div>

          <!-- Print Logs Table -->
          <div class="mt-4">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Print Logs</h3>
                <span class="text-sm text-gray-500 dark:text-gray-400">Showing {{ filteredPrints.length }} of {{ prints.length }} prints</span>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-blue-gray-700">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">ID</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Printer</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Document</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Timestamp</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Duration</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                      <tr v-for="print in filteredPrints" :key="print.id">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">#{{ print.id.toString().padStart(6, '0') }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ print.printer }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ print.document }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ print.timestamp }}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                                :class="{
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': print.status === 'Success',
                                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': print.status === 'Failed',
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': print.status === 'Warning'
                                }">
                            {{ print.status }}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ print.duration }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                          <div class="flex space-x-2">
                            <button class="text-gray-400 transition-colors duration-150 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" title="View Details">
                              <div class="i-hugeicons-view h-5 w-5"></div>
                            </button>
                            <button class="text-gray-400 transition-colors duration-150 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" title="Reprint">
                              <div class="i-hugeicons-refresh h-5 w-5"></div>
                            </button>
                            <button class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                              <div class="i-hugeicons-waste h-5 w-5"></div>
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">15</span> of <span class="font-medium">755</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-arrow-left-01 h-5 w-5" aria-hidden="true" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-700">2</a>
                  <a href="#" class="relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-700">3</a>
                  <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-gray-400 dark:ring-gray-600">...</span>
                  <a href="#" class="relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-700">50</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Next</span>
                    <div class="i-hugeicons-arrow-right-01 h-5 w-5" aria-hidden="true" />
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
