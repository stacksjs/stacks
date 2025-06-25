<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Pie, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
)

useHead({
  title: 'Receipt Printers - Analytics',
})

// Sample data for the printers dashboard
const printers = [
  { id: 1, username: 'Checkout-1', macAddress: '00:1B:44:11:3A:B7', location: 'Main Floor', terminal: 'POS-1', status: 'Online', lastPing: '2 mins ago', printCount: 1245, errorCount: 3 },
  { id: 2, username: 'Checkout-2', macAddress: '00:1B:44:11:3A:C8', location: 'Main Floor', terminal: 'POS-2', status: 'Online', lastPing: '1 min ago', printCount: 987, errorCount: 0 },
  { id: 3, username: 'Kitchen-1', macAddress: '00:1B:44:11:3B:D9', location: 'Kitchen', terminal: 'KDS-1', status: 'Offline', lastPing: '3 hours ago', printCount: 876, errorCount: 12 },
  { id: 4, username: 'Checkout-3', macAddress: '00:1B:44:11:3C:E0', location: 'Second Floor', terminal: 'POS-3', status: 'Online', lastPing: '5 mins ago', printCount: 765, errorCount: 1 },
  { id: 5, username: 'Pickup-1', macAddress: '00:1B:44:11:3D:F1', location: 'Pickup Area', terminal: 'POS-4', status: 'Warning', lastPing: '10 mins ago', printCount: 654, errorCount: 5 },
  { id: 6, username: 'Checkout-4', macAddress: '00:1B:44:11:3E:02', location: 'Main Floor', terminal: 'POS-5', status: 'Online', lastPing: '3 mins ago', printCount: 543, errorCount: 0 },
  { id: 7, username: 'Kitchen-2', macAddress: '00:1B:44:11:3F:13', location: 'Kitchen', terminal: 'KDS-2', status: 'Online', lastPing: '4 mins ago', printCount: 432, errorCount: 2 },
]

// Status distribution data for pie chart
const statusData = {
  labels: ['Online', 'Offline', 'Warning'],
  datasets: [
    {
      backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
      data: [5, 1, 1],
    },
  ],
}

// Print volume data for bar chart
const printVolumeData = {
  labels: ['Checkout-1', 'Checkout-2', 'Kitchen-1', 'Checkout-3', 'Pickup-1', 'Checkout-4', 'Kitchen-2'],
  datasets: [
    {
      label: 'Print Count',
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      data: [1245, 987, 876, 765, 654, 543, 432],
    },
  ],
}

// Error rate data for bar chart
const errorRateData = {
  labels: ['Checkout-1', 'Checkout-2', 'Kitchen-1', 'Checkout-3', 'Pickup-1', 'Checkout-4', 'Kitchen-2'],
  datasets: [
    {
      label: 'Error Count',
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      data: [3, 0, 12, 1, 5, 0, 2],
    },
  ],
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
    },
  },
}

const barChartOptions = {
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
const locationFilter = ref('All Locations')
const statusFilter = ref('All Statuses')
const locations = ['All Locations', 'Main Floor', 'Second Floor', 'Kitchen', 'Pickup Area']
const statuses = ['All Statuses', 'Online', 'Offline', 'Warning']

// Computed filtered printers
const filteredPrinters = computed(() => {
  return printers.filter(printer => {
    const locationMatch = locationFilter.value === 'All Locations' || printer.location === locationFilter.value
    const statusMatch = statusFilter.value === 'All Statuses' || printer.status === statusFilter.value
    return locationMatch && statusMatch
  })
})

// Stats summary
const totalPrinters = printers.length
const onlinePrinters = printers.filter(p => p.status === 'Online').length
const offlinePrinters = printers.filter(p => p.status === 'Offline').length
const warningPrinters = printers.filter(p => p.status === 'Warning').length
const totalPrints = printers.reduce((sum, printer) => sum + printer.printCount, 0)
const totalErrors = printers.reduce((sum, printer) => sum + printer.errorCount, 0)
const errorRate = ((totalErrors / totalPrints) * 100).toFixed(2)
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Receipt Printers Dashboard</h1>

          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage your receipt printers across all locations
          </p>

          <!-- Stats -->
          <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Printers</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalPrinters }}</dd>
              <dd class="mt-2 flex items-center text-sm">
                <span class="text-green-600 dark:text-green-400">{{ onlinePrinters }} Online</span>
                <span class="mx-2 text-gray-500 dark:text-gray-400">•</span>
                <span class="text-red-600 dark:text-red-400">{{ offlinePrinters }} Offline</span>
                <span class="mx-2 text-gray-500 dark:text-gray-400">•</span>
                <span class="text-yellow-600 dark:text-yellow-400">{{ warningPrinters }} Warning</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Prints</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalPrints.toLocaleString() }}</dd>
              <dd class="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>Across all printers</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Error Rate</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ errorRate }}%</dd>
              <dd class="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>{{ totalErrors }} total errors</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Printer Health</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {{ Math.round((onlinePrinters / totalPrinters) * 100) }}%
              </dd>
              <dd class="mt-2 flex items-center text-sm" :class="onlinePrinters === totalPrinters ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
                <div :class="onlinePrinters === totalPrinters ? 'i-hugeicons-check-circle h-4 w-4 mr-1' : 'i-hugeicons-alert-01 h-4 w-4 mr-1'"></div>
                <span>{{ onlinePrinters === totalPrinters ? 'All systems operational' : 'Attention needed' }}</span>
              </dd>
            </div>
          </dl>

          <!-- Charts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Printer Status</h3>
                <div class="mt-2 h-64">
                  <Pie :data="statusData" :options="chartOptions" />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800 lg:col-span-2">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Print Volume by Printer</h3>
                <div class="mt-2 h-64">
                  <Bar :data="printVolumeData" :options="barChartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="mt-8 flex flex-wrap gap-4">
            <div class="w-full sm:w-auto">
              <label for="location-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
              <select
                id="location-filter"
                v-model="locationFilter"
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
              >
                <option v-for="location in locations" :key="location" :value="location">{{ location }}</option>
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
          </div>

          <!-- Printers Table -->
          <div class="mt-4">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Receipt Printers</h3>
                <span class="text-sm text-gray-500 dark:text-gray-400">Showing {{ filteredPrinters.length }} of {{ printers.length }} printers</span>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-blue-gray-700">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Name</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Mac Address</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Location</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Terminal</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Last Ping</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Print Count</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                      <tr v-for="printer in filteredPrinters" :key="printer.id">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ printer.username }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ printer.macAddress }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ printer.location }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ printer.terminal }}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                                :class="{
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': printer.status === 'Online',
                                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': printer.status === 'Offline',
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': printer.status === 'Warning'
                                }">
                            {{ printer.status }}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ printer.lastPing }}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {{ printer.printCount.toLocaleString() }}
                          <span class="text-xs text-red-500 ml-1" v-if="printer.errorCount > 0">({{ printer.errorCount }} errors)</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          <div class="flex space-x-2">
                            <button class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                              <div class="i-hugeicons-refresh h-5 w-5"></div>
                            </button>
                            <button class="text-gray-400 transition-colors duration-150 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                              <div class="i-hugeicons-settings-02 h-5 w-5"></div>
                            </button>
                            <button class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                              <div class="i-hugeicons-electric-plugs h-5 w-5"></div>
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

          <!-- Error Rate Chart -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Error Count by Printer</h3>
                <div class="mt-2 h-64">
                  <Bar :data="errorRateData" :options="barChartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
