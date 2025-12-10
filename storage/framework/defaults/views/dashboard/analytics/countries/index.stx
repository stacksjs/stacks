<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Country Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface CountryData {
  name: string
  visitors: number
  percentage: number
  flag: string
  code?: string
}

interface CityData {
  name: string
  country: string
  visitors: number
  percentage: number
}

interface LanguageData {
  name: string
  code: string
  visitors: number
  percentage: number
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
const selectedDateRange = ref('all-time')
const dateRangeDisplay = ref('All Time: Sep 7, 2023 to Mar 6, 2025')
const comparisonType = ref('no-comparison')
const customStartDate = ref('')
const customEndDate = ref('')
const showCustomDateRange = computed(() => selectedDateRange.value === 'custom')

// Countries data with flag emojis
const countriesData = ref<CountryData[]>([
  { name: 'United States of America', visitors: 768, flag: '🇺🇸', code: 'US', percentage: 35 },
  { name: 'Germany', visitors: 140, flag: '🇩🇪', code: 'DE', percentage: 12 },
  { name: 'United Kingdom', visitors: 87, flag: '🇬🇧', code: 'GB', percentage: 8 },
  { name: 'India', visitors: 83, flag: '🇮🇳', code: 'IN', percentage: 7 },
  { name: 'Indonesia', visitors: 80, flag: '🇮🇩', code: 'ID', percentage: 7 },
  { name: 'Canada', visitors: 75, flag: '🇨🇦', code: 'CA', percentage: 6 },
  { name: 'Australia', visitors: 68, flag: '🇦🇺', code: 'AU', percentage: 6 },
  { name: 'France', visitors: 62, flag: '🇫🇷', code: 'FR', percentage: 5 },
  { name: 'Brazil', visitors: 58, flag: '🇧🇷', code: 'BR', percentage: 5 },
  { name: 'Japan', visitors: 52, flag: '🇯🇵', code: 'JP', percentage: 4 },
  { name: 'Netherlands', visitors: 45, flag: '🇳🇱', code: 'NL', percentage: 4 },
  { name: 'Spain', visitors: 42, flag: '🇪🇸', code: 'ES', percentage: 3 }
])

// Cities data
const citiesData = ref<CityData[]>([
  { name: 'New York', country: 'United States of America', visitors: 120, percentage: 10 },
  { name: 'London', country: 'United Kingdom', visitors: 87, percentage: 7 },
  { name: 'Berlin', country: 'Germany', visitors: 75, percentage: 6 },
  { name: 'San Francisco', country: 'United States of America', visitors: 68, percentage: 6 },
  { name: 'Mumbai', country: 'India', visitors: 65, percentage: 5 },
  { name: 'Toronto', country: 'Canada', visitors: 62, percentage: 5 },
  { name: 'Jakarta', country: 'Indonesia', visitors: 60, percentage: 5 },
  { name: 'Sydney', country: 'Australia', visitors: 58, percentage: 5 },
  { name: 'Paris', country: 'France', visitors: 55, percentage: 4 },
  { name: 'Los Angeles', country: 'United States of America', visitors: 52, percentage: 4 }
])

// Languages data
const languagesData = ref<LanguageData[]>([
  { name: 'English', code: 'en-US', visitors: 980, percentage: 45 },
  { name: 'German', code: 'de-DE', visitors: 140, percentage: 12 },
  { name: 'English (UK)', code: 'en-GB', visitors: 87, percentage: 8 },
  { name: 'Hindi', code: 'hi-IN', visitors: 83, percentage: 7 },
  { name: 'Indonesian', code: 'id-ID', visitors: 80, percentage: 7 },
  { name: 'French', code: 'fr-FR', visitors: 62, percentage: 5 },
  { name: 'Portuguese', code: 'pt-BR', visitors: 58, percentage: 5 },
  { name: 'Japanese', code: 'ja-JP', visitors: 52, percentage: 4 },
  { name: 'Dutch', code: 'nl-NL', visitors: 45, percentage: 4 },
  { name: 'Spanish', code: 'es-ES', visitors: 42, percentage: 3 }
])

// Chart.js configuration for country distribution
const chartConfig = reactive({
  type: 'bar' as keyof ChartTypeRegistry,
  data: {
    labels: countriesData.value.slice(0, 10).map(item => item.name),
    datasets: [
      {
        label: 'Visitors',
        data: countriesData.value.slice(0, 10).map(item => item.visitors),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(234, 179, 8, 0.8)'
        ],
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1
      }
    ]
  },
  options: {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw || 0;
            const total = countriesData.value.reduce((a, b) => a + b.visitors, 0);
            const percentage = Math.round((value / total) * 100);
            return `${value} visitors (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  }
})

// World map data for visualization
const mapData = ref({
  // This would be used with a mapping library like jVectorMap or a GeoJSON visualization
  // For now, we'll just use the countries data for demonstration
})

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Mock function to update data when date range changes
function updateDataForDateRange(): void {
  console.log('Updating data for date range:', selectedDateRange.value)
}

// Watch for date range changes
function handleDateRangeChange(): void {
  updateDataForDateRange()
}

// Initialize chart when component is mounted
let countryChart: Chart | null = null

onMounted(() => {
  const ctx = document.getElementById('countryChart') as HTMLCanvasElement
  if (ctx) {
    countryChart = new Chart(ctx, chartConfig)
  }

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
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ dateRangeDisplay }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">compared to</span>

            <div class="relative">
              <select
                v-model="comparisonType"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="no-comparison">No comparison</option>
                <option value="previous-period">Previous period</option>
                <option value="previous-year">Previous year</option>
              </select>
            </div>

            <button
              type="button"
              class="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-settings-01 h-4 w-4 mr-1"></div>
              Auto
            </button>
          </div>
        </div>

        <!-- Page Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Country Analytics</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed breakdown of visitor locations across your website
          </p>
        </div>

        <!-- Country Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Top Countries</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Visitors by country of origin
            </p>
          </div>

          <div class="h-96 w-full">
            <canvas id="countryChart"></canvas>
          </div>
        </div>

        <!-- World Map Visualization (Placeholder) -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">World Map</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Geographic distribution of visitors
            </p>
          </div>

          <div class="h-96 w-full flex items-center justify-center bg-gray-100 dark:bg-blue-gray-700 rounded-lg">
            <p class="text-gray-500 dark:text-gray-400">World map visualization would be displayed here</p>
          </div>
        </div>

        <!-- Countries Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Countries</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Country
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(country, index) in countriesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-rose-100/50 dark:bg-rose-900/50" :style="{ width: country.percentage + '%' }"></div>
                    <span class="relative z-10"><span class="mr-2">{{ country.flag }}</span>{{ country.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ country.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ country.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Cities Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Cities</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Top cities by visitor count
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    City
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Country
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(city, index) in citiesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/50" :style="{ width: city.percentage + '%' }"></div>
                    <span class="relative z-10">{{ city.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ city.country }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ city.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ city.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Languages Data Table -->
        <div>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Languages</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Browser language settings of visitors
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Language
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Code
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(language, index) in languagesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-green-100/50 dark:bg-green-900/50" :style="{ width: language.percentage + '%' }"></div>
                    <span class="relative z-10">{{ language.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ language.code }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ language.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ language.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
