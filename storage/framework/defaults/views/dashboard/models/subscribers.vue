<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Subscribers
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                1,234
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Unsubscribes
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                12
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                4
              </p>

              <!-- <div class="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                <div class="text-sm">
                  <a href="#" class="font-medium text-blue-600 hover:text-blue-500">View all<span class="sr-only"> Average Deploy Time</span></a>
                </div>
              </div> -->
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Growth Chart -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Subscriber Growth</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Track subscriber count over time</p>
            </div>
            <div class="flex items-center space-x-4">
              <select
                v-model="timeRange"
                class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
          </div>
          <div class="h-[400px] relative">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Subscribers
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all your project subscribers.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
            Add Subscriber
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                      ID
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Email
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      User
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Status
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Unsubscribed At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Created At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      1
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                        chris@stacksjs.org
                      </div>
                    </td>

                    <!-- could be empty if no relationship exists -->
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      Chris Breuer
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs text-green-700 font-medium ring-1 ring-green-600/20 ring-inset">Subscribed</span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      <!-- 2024/01/22 11:00am -->
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      2024/01/02
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Edit<span class="sr-only">, Subscriber</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      2
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                        buddy@stacksjs.org
                      </div>
                    </td>

                    <!-- could be empty if no relationship exists -->
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <!-- Chris Breuer -->
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 font-medium ring-1 ring-slate-600/20 ring-inset">Unsubscribed</span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      2024/01/22 11:00am
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      2024/01/02
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Edit<span class="sr-only">, Subscriber</span></a>
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
  Scale,
  CoreScaleOptions,
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
  title: 'Dashboard - Subscribers',
})

const timeRange = ref<'7' | '30' | '90' | '365'>('30')
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
  return Array.from({ length: days }, (_, i) => formatDate(days - 1 - i)).reverse()
}

// Generate mock growth data
const generateGrowthData = (days: number, baseCount: number, dailyGrowth: number) => {
  return Array.from({ length: days }, (_, i) => {
    const dayVariance = Math.random() * dailyGrowth * 0.5 // 50% variance
    return Math.floor(baseCount + (dailyGrowth * i) + dayVariance)
  })
}

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      type: 'linear' as const,
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        callback: function(this: Scale<CoreScaleOptions>, tickValue: string | number) {
          const value = Number(tickValue)
          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
          return value.toString()
        }
      },
    },
    x: {
      type: 'category' as const,
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
      callbacks: {
        label: (context: any) => {
          let label = context.dataset.label || ''
          if (label) label += ': '
          if (context.parsed.y !== null) {
            const value = context.parsed.y
            if (value >= 1000000) return `${label}${(value / 1000000).toFixed(1)}M subscribers`
            if (value >= 1000) return `${label}${(value / 1000).toFixed(1)}k subscribers`
            return `${label}${value} subscribers`
          }
          return label
        }
      }
    }
  },
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
} as const

// Chart data
const chartData = computed(() => {
  const days = parseInt(timeRange.value)
  const labels = generateDateLabels(days)
  const baseCount = 500 // Starting with 500 subscribers
  const dailyGrowth = 5 // Average 5 new subscribers per day

  return {
    labels,
    datasets: [{
      label: 'Total Subscribers',
      data: generateGrowthData(days, baseCount, dailyGrowth),
      borderColor: 'rgb(14, 165, 233)', // Sky blue color for subscribers
      backgroundColor: 'rgba(14, 165, 233, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})
</script>
