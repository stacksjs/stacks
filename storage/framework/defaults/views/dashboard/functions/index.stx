<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
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
  title: 'Dashboard - Functions',
})

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
        callback: (value: number) => {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
          if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
          return value
        }
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
      callbacks: {
        label: (context: any) => {
          let label = context.dataset.label || ''
          if (label) label += ': '
          if (context.parsed.y !== null) {
            const value = context.parsed.y
            if (value >= 1000000) label += (value / 1000000).toFixed(1) + 'M'
            else if (value >= 1000) label += (value / 1000).toFixed(1) + 'k'
            else label += value
          }
          return label + ' downloads'
        }
      }
    }
  },
  elements: {
    line: {
      tension: 0.4,
    },
  },
}

const comparePackage = ref('')
const timeRange = ref<'7' | '30' | '90' | '365'>('7')
const isLoading = ref(false)

// Helper function to format dates
const formatDate = (daysAgo: number) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

// Generate date labels for the selected time range
const generateDateLabels = (days: number) => {
  // Start from oldest date and move towards today
  return Array.from({ length: days }, (_, i) => formatDate(i))
}

// Generate mock growth data
const generateGrowthData = (days: number, baseCount: number, dailyGrowth: number) => {
  // Start from oldest date and move towards today
  return Array.from({ length: days }, (_, i) => {
    const dayVariance = Math.random() * dailyGrowth * 0.5 // 50% variance
    const daysFromStart = i
    return Math.floor(baseCount + (dailyGrowth * daysFromStart) + dayVariance)
  })
}

interface FunctionStats {
  labels: string[]
  data: number[]
  compareData: number[]
}

interface FunctionStatsMap {
  '7': FunctionStats
  '30': FunctionStats
  '90': FunctionStats
  '365': FunctionStats
}

const functionStats = ref<FunctionStatsMap>({
  '7': {
    labels: generateDateLabels(7),
    data: [8500, 11800, 10200, 12800, 15200, 14100, 13200],
    compareData: [6500, 8800, 7200, 9800, 11200, 10100, 9200]
  },
  '30': {
    labels: generateDateLabels(30),
    data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 15000) + 8000),
    compareData: Array.from({ length: 30 }, () => Math.floor(Math.random() * 12000) + 6000)
  },
  '90': {
    labels: generateDateLabels(90),
    data: Array.from({ length: 90 }, () => Math.floor(Math.random() * 15000) + 8000),
    compareData: Array.from({ length: 90 }, () => Math.floor(Math.random() * 12000) + 6000)
  },
  '365': {
    labels: generateDateLabels(365),
    data: Array.from({ length: 365 }, () => Math.floor(Math.random() * 15000) + 8000),
    compareData: Array.from({ length: 365 }, () => Math.floor(Math.random() * 12000) + 6000)
  }
})

// Function to fetch function invocation data from API
const fetchFunctionData = async (days: '7' | '30' | '90' | '365') => {
  isLoading.value = true
  try {
    // Here you would make your API call
    // const response = await fetch(`/api/functions/stats?days=${days}`)
    // const data = await response.json()
    // functionStats.value[days] = data

    // For now we're using the mock data already set in functionStats
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
  } catch (error) {
    console.error('Error fetching function data:', error)
  } finally {
    isLoading.value = false
  }
}

// Watch for time range changes
watch(timeRange, async (newRange) => {
  await fetchFunctionData(newRange)
})

// Mock data for downloads chart
const downloadsData = computed(() => ({
  labels: functionStats.value[timeRange.value].labels,
  datasets: [
    {
      label: '@your/function',
      data: functionStats.value[timeRange.value].data,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
    },
    ...(comparePackage.value ? [{
      label: comparePackage.value,
      data: functionStats.value[timeRange.value].compareData,
      borderColor: 'rgb(234, 179, 8)',
      backgroundColor: 'rgba(234, 179, 8, 0.1)',
      fill: true,
    }] : [])
  ]
}))

const handleCompare = async () => {
  if (comparePackage.value) {
    // Here you would fetch comparison data from API
    // await fetchComparisonData(comparePackage.value, timeRange.value)
    await fetchFunctionData(timeRange.value)
  }
}

// Initial data fetch
onMounted(async () => {
  await fetchFunctionData(timeRange.value)
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
          Last {{ timeRange }} days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-cloud-download h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium ">
                Total Downloads
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>

                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Avg. Release Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                3.65 mins
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-rocket-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Releases
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                420
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 dark:text-red-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Decreased by </span>
                3.2%
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Downloads Chart -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Download Activity</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Compare package downloads over time</p>
            </div>
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                <input
                  v-model="comparePackage"
                  type="text"
                  placeholder="Compare with package..."
                  @keyup.enter="handleCompare"
                  class="block w-64 rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
                <button
                  @click="handleCompare"
                  class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Compare
                </button>
              </div>
              <select
                v-model="timeRange"
                class="text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 365 days</option>
              </select>
            </div>
          </div>
          <div class="h-[400px] relative">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
            <Line :data="downloadsData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Functions
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all the functions in your library.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Create Function
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-600 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-700">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:pl-6">
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Size
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Path
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Updated At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Created At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      Function A
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      5kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      ./resources/functions/function-a.ts
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      04-19-2022 09:04:20
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      01-03-2023 08:23:15
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit<span class="sr-only">, Component A, in IDE</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      Function B
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      5kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      ./resources/functions/function-a.ts
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      04-19-2022 09:04:20
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      01-03-2023 08:23:15
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit<span class="sr-only">, Component A, in IDE</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      Function C
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      5kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      ./resources/functions/function-a.ts
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      04-19-2022 09:04:20
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      01-03-2023 08:23:15
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit<span class="sr-only">, Component A, in IDE</span></a>
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
