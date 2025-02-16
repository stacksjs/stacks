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
  Scale,
  ChartOptions,
  ScaleOptionsByType,
  CartesianScaleTypeRegistry,
  CoreScaleOptions,
  Tick,
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
  title: 'Dashboard - Packages',
})

const packages = [
  {
    name: 'stacks',
    version: 'v0.68.2',
    downloads: 1001897,
    issues: 12,
    contributors: 24,
    size: '5.2kb',
    path: './packages/stacks/*',
    createdAt: '2024-01-15',
    codename: 'Playa Vista',
    description: 'A modern Full Stack TypeScript framework',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'qrx',
    version: 'v1.0.0',
    downloads: 71897,
    issues: 12,
    contributors: 24,
    size: '5.2kb',
    path: './packages/qrx/*',
    createdAt: '2024-01-15',
    codename: 'Quantum',
    description: 'High-performance QR code generator and reader',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'rpx',
    version: 'v2.1.3',
    downloads: 52438,
    issues: 8,
    contributors: 16,
    size: '4.8kb',
    path: './packages/rpx/*',
    createdAt: '2024-01-20',
    codename: 'Rapid',
    description: 'Real-time pixel manipulation library',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'tlsx',
    version: 'v0.9.0',
    downloads: 23567,
    issues: 15,
    contributors: 9,
    size: '7.1kb',
    path: './packages/tlsx/*',
    createdAt: '2024-01-25',
    codename: 'Secure',
    description: 'Modern TLS/SSL toolkit for Node.js',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'dtsx',
    version: 'v1.2.0',
    downloads: 34892,
    issues: 6,
    contributors: 12,
    size: '3.9kb',
    path: './packages/dtsx/*',
    createdAt: '2024-01-30',
    codename: 'TypeMaster',
    description: 'Advanced TypeScript tooling',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bunfig',
    version: 'v0.8.0',
    downloads: 18234,
    issues: 10,
    contributors: 7,
    size: '2.8kb',
    path: './packages/bunfig/*',
    createdAt: '2024-02-05',
    codename: 'Configure',
    description: 'Configuration management for Bun projects',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'localtunnels',
    version: 'v1.5.0',
    downloads: 45673,
    issues: 14,
    contributors: 19,
    size: '6.3kb',
    path: './packages/localtunnels/*',
    createdAt: '2024-02-10',
    codename: 'Tunnel',
    description: 'Secure local tunnel creation made easy',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'ts-collect',
    version: 'v2.0.1',
    downloads: 28945,
    issues: 9,
    contributors: 11,
    size: '4.1kb',
    path: './packages/ts-collect/*',
    createdAt: '2024-02-15',
    codename: 'Collector',
    description: 'Collection utilities for TypeScript',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'ts-spreadsheets',
    version: 'v1.3.2',
    downloads: 39567,
    issues: 11,
    contributors: 15,
    size: '8.2kb',
    path: './packages/ts-spreadsheets/*',
    createdAt: '2024-02-20',
    codename: 'Excel',
    description: 'TypeScript spreadsheet manipulation',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bun-plugin-auto-imports',
    version: 'v0.6.0',
    downloads: 15678,
    issues: 7,
    contributors: 5,
    size: '3.4kb',
    path: './packages/bun-plugin-auto-imports/*',
    createdAt: '2024-02-25',
    codename: 'AutoImport',
    description: 'Automatic import handling for Bun',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bun-plugin-dtsx',
    version: 'v0.5.0',
    downloads: 12345,
    issues: 5,
    contributors: 4,
    size: '2.9kb',
    path: './packages/bun-plugin-dtsx/*',
    createdAt: '2024-03-01',
    codename: 'TypePlugin',
    description: 'DTSX support for Bun',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'vite-plugin-local',
    version: 'v1.1.0',
    downloads: 31456,
    issues: 13,
    contributors: 8,
    size: '4.7kb',
    path: './packages/vite-plugin-local/*',
    createdAt: '2024-03-05',
    codename: 'Local',
    description: 'Local development enhancements for Vite',
    stars: Math.floor(Math.random() * 1000) + 100
  }
]

const getPackageUrl = (pkgName: string) => `https://github.com/stacksjs/${pkgName}`

const colors = [
  { border: 'rgb(59, 130, 246)', background: 'rgba(59, 130, 246, 0.8)' },
  { border: 'rgb(234, 179, 8)', background: 'rgba(234, 179, 8, 0.8)' },
  { border: 'rgb(239, 68, 68)', background: 'rgba(239, 68, 68, 0.8)' },
  { border: 'rgb(16, 185, 129)', background: 'rgba(16, 185, 129, 0.8)' },
  { border: 'rgb(168, 85, 247)', background: 'rgba(168, 85, 247, 0.8)' },
]

// Update the chart options to use proper typing
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      type: 'linear' as const,
      beginAtZero: true,
      min: 0,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        callback: function(this: Scale<CoreScaleOptions>, tickValue: number | string, index: number, ticks: Tick[]) {
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
  },
}

const timeChartOptions = {
  ...baseChartOptions,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    ...baseChartOptions.plugins,
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: (context: any) => {
          let label = context.dataset.label || ''
          if (label) label += ': '
          if (context.parsed.y !== null) {
            const value = context.parsed.y
            if (value >= 1000000) return `${label}${(value / 1000000).toFixed(1)}M downloads`
            if (value >= 1000) return `${label}${(value / 1000).toFixed(1)}k downloads`
            return `${label}${value} downloads`
          }
          return label
        }
      }
    }
  },
}

// Sort packages by downloads for better visualization
const sortedPackages = computed(() => {
  return [...packages].sort((a, b) => b.downloads - a.downloads)
})

// Chart data for downloads
const downloadsData = computed(() => ({
  labels: sortedPackages.value.map(pkg => pkg.name),
  datasets: [{
    label: 'Downloads',
    data: sortedPackages.value.map(pkg => pkg.downloads),
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    borderColor: 'rgb(59, 130, 246)',
    borderWidth: 1
  }]
}))

// Chart data for contributors
const contributorsData = computed(() => ({
  labels: sortedPackages.value.map(pkg => pkg.name),
  datasets: [{
    label: 'Contributors',
    data: sortedPackages.value.map(pkg => pkg.contributors),
    backgroundColor: 'rgba(234, 179, 8, 0.8)',
    borderColor: 'rgb(234, 179, 8)',
    borderWidth: 1
  }]
}))

// Chart data for issues
const issuesData = computed(() => ({
  labels: sortedPackages.value.map(pkg => pkg.name),
  datasets: [{
    label: 'Open Issues',
    data: sortedPackages.value.map(pkg => pkg.issues),
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderColor: 'rgb(239, 68, 68)',
    borderWidth: 1
  }]
}))

// Customize options for different metrics
const contributorsOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    tooltip: {
      callbacks: {
        label: (context: any) => {
          return `Contributors: ${context.parsed.y}`
        }
      }
    }
  }
} as const

const issuesOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    tooltip: {
      callbacks: {
        label: (context: any) => {
          return `Open Issues: ${context.parsed.y}`
        }
      }
    }
  }
} as const

const timeRange = ref<'7' | '30' | '90' | '365'>('30')
const displayMode = ref<'line' | 'bar'>('line')
const selectedPackages = ref<Set<string>>(new Set())
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

// Generate mock daily download data for a package
const generateDailyData = (baseDownloads: number, days: number) => {
  return Array.from({ length: days }, () => {
    const variance = baseDownloads * 0.2 // 20% variance
    return Math.floor(baseDownloads / days + (Math.random() - 0.5) * variance)
  })
}

// Computed property to determine if we should use compact mode
const useCompactMode = computed(() => packages.length > 10)

// Computed property for filtered and sorted packages
const filteredPackages = computed(() => {
  let filtered = [...packages]
  if (useCompactMode.value && selectedPackages.value.size === 0) {
    // In compact mode, default to showing top 5 packages by downloads
    filtered = filtered.sort((a, b) => b.downloads - a.downloads).slice(0, 5)
  } else if (selectedPackages.value.size > 0) {
    filtered = filtered.filter(pkg => selectedPackages.value.has(pkg.name))
  }
  return filtered.sort((a, b) => b.downloads - a.downloads)
})

// Chart data for downloads over time
const downloadsTimeData = computed(() => {
  const days = parseInt(timeRange.value)
  const labels = generateDateLabels(days)

  return {
    labels,
    datasets: filteredPackages.value.map((pkg, index) => {
      const colorIndex = index % colors.length
      const color = colors[colorIndex]
      if (!color) return null

      return {
        label: pkg.name,
        data: generateDailyData(pkg.downloads, days),
        borderColor: color.border,
        backgroundColor: displayMode.value === 'line'
          ? color.background.replace('0.8', '0.1')
          : color.background,
        fill: true,
        tension: 0.4
      }
    }).filter((dataset): dataset is NonNullable<typeof dataset> => dataset !== null)
  }
})

</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats section -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <!-- Total Downloads -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-arrow-down-tray h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Downloads
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.downloads, 0).toLocaleString() }}
              </p>
            </dd>
          </div>

          <!-- Total Contributors -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-users h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Contributors
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.contributors, 0) }}
              </p>
            </dd>
          </div>

          <!-- Total Issues -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-bug-ant h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Issues
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.issues, 0) }}
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div class="grid grid-cols-1 gap-8">
        <!-- Downloads Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Package Downloads</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Downloads over time per package</p>
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
                <div v-if="useCompactMode" class="flex items-center space-x-2">
                  <select
                    v-model="selectedPackages"
                    multiple
                    class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 max-h-32"
                  >
                    <option v-for="pkg in packages" :key="pkg.name" :value="pkg.name">
                      {{ pkg.name }}
                    </option>
                  </select>
                  <button
                    @click="selectedPackages.clear()"
                    class="h-9 px-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-blue-gray-500"
                  >
                    Clear
                  </button>
                </div>
                <div class="flex rounded-md shadow-sm h-9">
                  <button
                    @click="displayMode = 'line'"
                    :class="[
                      'px-3 py-2 text-sm font-semibold rounded-l-md ring-1 ring-inset transition-colors',
                      displayMode === 'line'
                        ? 'bg-blue-600 text-white ring-blue-600'
                        : 'bg-white text-gray-600 hover:bg-gray-50 ring-gray-300 dark:bg-blue-gray-600 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-500'
                    ]"
                  >
                    Line
                  </button>
                  <button
                    @click="displayMode = 'bar'"
                    :class="[
                      'px-3 py-2 text-sm font-semibold rounded-r-md ring-1 ring-inset transition-colors -ml-px',
                      displayMode === 'bar'
                        ? 'bg-blue-600 text-white ring-blue-600'
                        : 'bg-white text-gray-600 hover:bg-gray-50 ring-gray-300 dark:bg-blue-gray-600 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-500'
                    ]"
                  >
                    Bar
                  </button>
                </div>
              </div>
            </div>
            <div class="h-[400px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <component
                :is="displayMode === 'line' ? Line : Bar"
                :data="downloadsTimeData"
                :options="timeChartOptions"
              />
            </div>
          </div>
        </div>

        <!-- Contributors Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="mb-6">
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Package Contributors</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Number of contributors per package</p>
            </div>
            <div class="h-[400px]">
              <Bar :data="contributorsData" :options="contributorsOptions" />
            </div>
          </div>
        </div>

        <!-- Issues Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="mb-6">
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Open Issues</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Number of open issues per package</p>
            </div>
            <div class="h-[400px]">
              <Bar :data="issuesData" :options="issuesOptions" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Packages Table section -->
    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Packages
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all the packages you are tracking.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Add Package
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
                      Package
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Description
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Version
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Downloads
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Size
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Created At
                    </th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">View</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="pkg in packages" :key="pkg.name">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div class="flex items-center">
                        <div>
                          <div class="font-medium text-gray-900">{{ pkg.name }}</div>
                          <div class="text-gray-500">{{ pkg.codename }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-md truncate">
                      {{ pkg.description }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {{ pkg.version }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {{ pkg.downloads.toLocaleString() }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                      {{ pkg.size }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {{ pkg.createdAt }}
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a :href="getPackageUrl(pkg.name)" class="text-blue-600 hover:text-blue-900">
                        View<span class="sr-only">, {{ pkg.name }} package</span>
                      </a>
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
