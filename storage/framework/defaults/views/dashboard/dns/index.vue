<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - DNS',
})

const timeRange = ref<'day' | 'week' | 'month' | 'year'>('day')
const isLoading = ref(false)

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        boxWidth: 12,
        padding: 15,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
}

// Generate mock DNS records data
const getDNSRecordsData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'A Records',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10) + 5),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'CNAME Records',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 8) + 3),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'MX Records',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 5) + 1),
        borderColor: 'rgb(245, 158, 11)', // Yellow
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
      },
    ],
  }
}

const dnsRecordsData = ref(getDNSRecordsData())

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  dnsRecordsData.value = getDNSRecordsData()
  isLoading.value = false
})

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- DNS Records Chart -->
      <div class="mb-8">
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">DNS Records Over Time</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Distribution of DNS record types</p>
              </div>
              <select
                v-model="timeRange"
                class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <div class="h-[300px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="dnsRecordsData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>

      <div class="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            DNS Records
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
            A list of all your project DNS records.
          </p>
        </div>
        <button type="button" class="mt-4 sm:mt-0 block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
          Add Record
        </button>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                      Type
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Content
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      TTL
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Status
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      A
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      admin-api
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      666.666.666
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      Auto
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      Proxied
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">View<span class="sr-only">, DNS Record</span></a>
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
</template>
