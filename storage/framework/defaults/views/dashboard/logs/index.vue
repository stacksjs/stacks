<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
  title: 'Dashboard - Logs',
})

interface Log {
  id: string
  timestamp: string
  type: 'info' | 'error' | 'success'
  source: 'CLI' | 'File' | 'System'
  message: string
  metadata: Record<string, any>
  project?: string // Added project field
}

interface Project {
  id: string
  name: string
  color: string
}

const logs = ref<Log[]>([])
const filter = ref('all')
const searchTerm = ref('')
const autoRefresh = ref(true)
const selectedLog = ref<Log | null>(null)
const selectedProjects = ref<string[]>([])
const isLoading = ref(false)

// Sample projects
const projects: Project[] = [
  { id: 'stacks', name: 'Stacks', color: 'blue' },
  { id: 'rpx', name: 'rpx', color: 'purple' },
  { id: 'tlsx', name: 'tlsx', color: 'green' },
  { id: 'dtsx', name: 'dtsx', color: 'indigo' },
  { id: 'ts-collect', name: 'ts-collect', color: 'rose' },
  { id: 'vite-plugin-local', name: 'vite-plugin-local', color: 'amber' },
]

// Updated sample logs with project information
const sampleLogs: Log[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    type: 'info',
    source: 'CLI',
    message: 'buddy build started',
    metadata: { user: 'chris@stacksjs.org', command: 'buddy build' },
    project: 'stacks'
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 5000).toISOString(),
    type: 'error',
    source: 'File',
    message: 'Failed to compile component',
    metadata: { file: './components/Header.vue', line: 42 },
    project: 'rpx'
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 15000).toISOString(),
    type: 'success',
    source: 'System',
    message: 'Production deployment successful',
    metadata: {
      deployment_id: 'dep_abc123',
      environment: 'production',
      branch: 'main',
      commit: '7829abc',
      duration: '45s'
    },
    project: 'stacks'
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    type: 'info',
    source: 'CLI',
    message: 'Starting database migration',
    metadata: {
      migration: 'create_users_table',
      database: 'production',
      user: 'deploy@stacksjs.org'
    },
    project: 'stacks'
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    type: 'error',
    source: 'System',
    message: 'Failed to connect to Redis cache',
    metadata: {
      error: 'Connection timeout',
      host: 'redis.internal',
      port: 6379,
      attempt: 3
    },
    project: 'stacks'
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    type: 'success',
    source: 'CLI',
    message: 'Assets compiled successfully',
    metadata: {
      duration: '12.5s',
      assets: ['main.js', 'vendor.js', 'app.css'],
      size: '2.3MB'
    },
    project: 'stacks'
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 240000).toISOString(),
    type: 'info',
    source: 'System',
    message: 'Auto-scaling triggered',
    metadata: {
      reason: 'High CPU usage',
      current_instances: 3,
      target_instances: 5,
      region: 'us-east-1'
    },
    project: 'stacks'
  },
  {
    id: '8',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    type: 'success',
    source: 'File',
    message: 'Configuration cache cleared',
    metadata: {
      triggered_by: 'deployment',
      cache_size: '156KB',
      duration: '0.8s'
    },
    project: 'stacks'
  },
  {
    id: '9',
    timestamp: new Date(Date.now() - 360000).toISOString(),
    type: 'info',
    source: 'CLI',
    message: 'Running test suite',
    metadata: {
      suite: 'Integration Tests',
      total_tests: 156,
      parallel: true,
      ci: true
    },
    project: 'stacks'
  },
  {
    id: '10',
    timestamp: new Date(Date.now() - 420000).toISOString(),
    type: 'error',
    source: 'System',
    message: 'SSL certificate expiring soon',
    metadata: {
      domain: 'api.stacksjs.org',
      expires_in: '7 days',
      certificate_id: 'cert_xyz789'
    },
    project: 'stacks'
  }
]

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.value.toLowerCase())
    const matchesSource = filter.value === 'all' || log.source.toLowerCase() === filter.value.toLowerCase()
    const matchesProject = selectedProjects.value.length === 0 ||
      (log.project && selectedProjects.value.includes(log.project))

    return matchesSearch && matchesSource && matchesProject
  })
})

const getProjectClasses = (projectId: string): { bg: string, text: string, ring: string } => {
  switch (projectId) {
    case 'stacks':
      return { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-500' }
    case 'rpx':
      return { bg: 'bg-purple-100', text: 'text-purple-800', ring: 'ring-purple-500' }
    case 'tlsx':
      return { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-500' }
    case 'dtsx':
      return { bg: 'bg-indigo-100', text: 'text-indigo-800', ring: 'ring-indigo-500' }
    case 'ts-collect':
      return { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-500' }
    case 'vite-plugin-local':
      return { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-500' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', ring: 'ring-gray-500' }
  }
}

const toggleProject = (projectId: string) => {
  const index = selectedProjects.value.indexOf(projectId)
  if (index === -1) {
    selectedProjects.value.push(projectId)
  } else {
    selectedProjects.value.splice(index, 1)
  }
}

const getLogIcon = (type: Log['type']) => {
  switch (type) {
    case 'error':
      return 'i-heroicons-outline-exclamation-circle'
    case 'info':
      return 'i-heroicons-outline-information-circle'
    case 'success':
      return 'i-heroicons-outline-check-circle'
    default:
      return 'i-heroicons-outline-terminal'
  }
}

const getLogIconColor = (type: Log['type']) => {
  switch (type) {
    case 'error':
      return 'text-red-500'
    case 'info':
      return 'text-blue-500'
    case 'success':
      return 'text-green-500'
    default:
      return 'text-gray-500'
  }
}

const getLogRowClass = (type: Log['type']) => {
  switch (type) {
    case 'error':
      return 'bg-red-50'
    case 'success':
      return 'bg-green-50'
    default:
      return ''
  }
}

let refreshInterval: number | undefined

onMounted(() => {
  logs.value = sampleLogs
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

const startAutoRefresh = () => {
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(() => {
      // In reality, this would fetch new logs
      // fetchNewLogs()
    }, 2000)
  }
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = undefined
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

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

// Generate mock log volume data
const getLogVolumeData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'Info',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100) + 50),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Error',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 20)),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
      {
        label: 'Success',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 40) + 20),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
    ],
  }
}

const logVolumeData = ref(getLogVolumeData())

// Add timeRange ref
const timeRange = ref<'day' | 'week' | 'month' | 'year'>('day')

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  logVolumeData.value = getLogVolumeData()
  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Log Volume Chart -->
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Log Volume</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Distribution of log types over time</p>
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
            <Line :data="logVolumeData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <div class="mt-8 sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            System Logs
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
            A list of all system logs. Monitor system activities and events in real-time.
          </p>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="mt-8 flow-root">
        <div class="mb-6 space-y-4">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-[200px]">
              <input
                v-model="searchTerm"
                type="text"
                placeholder="Search logs..."
                class="w-full px-4 py-2 border rounded-lg"
              >
            </div>

            <select
              v-model="filter"
              class="px-4 py-2 border rounded-lg bg-white min-w-[140px]"
            >
              <option value="all">All Sources</option>
              <option value="cli">CLI</option>
              <option value="file">File</option>
              <option value="system">System</option>
            </select>

            <button
              class="flex items-center gap-2 px-4 py-2 rounded-lg"
              :class="autoRefresh ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="toggleAutoRefresh"
            >
              <i
                class="i-heroicons-outline-refresh h-4 w-4"
                :class="{ 'animate-spin': autoRefresh }"
                aria-hidden="true"
              />
              {{ autoRefresh ? 'Auto-refreshing' : 'Auto-refresh' }}
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="project in projects"
              :key="project.id"
              @click="toggleProject(project.id)"
              class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors"
              :class="[
                selectedProjects.includes(project.id)
                  ? [...Object.values(getProjectClasses(project.id)), 'ring-2']
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              {{ project.name }}
              <span
                v-if="selectedProjects.includes(project.id)"
                class="ml-2 text-xs"
              >×</span>
            </button>
          </div>
        </div>

        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr
                    v-for="log in filteredLogs"
                    :key="log.id"
                    :class="[getLogRowClass(log.type), 'hover:bg-gray-50 cursor-pointer']"
                    @click="selectedLog = log"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <i
                          :class="[getLogIcon(log.type), getLogIconColor(log.type), 'h-5 w-5']"
                          aria-hidden="true"
                        />
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {{ log.source }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900">{{ log.message }}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        v-if="log.project"
                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="[getProjectClasses(log.project).bg, getProjectClasses(log.project).text]"
                      >
                        {{ projects.find(p => p.id === log.project)?.name }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <div class="text-sm text-gray-900">
                        <i
                          class="i-heroicons-outline-clock h-4 w-4 mr-2 text-gray-400"
                          aria-hidden="true"
                        />
                        {{ new Date(log.timestamp).toLocaleTimeString() }}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <button class="text-blue-600 hover:text-blue-900">
                        View
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Teleport to="body">
          <div
            v-if="selectedLog"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            @click.self="selectedLog = null"
          >
            <div class="bg-white rounded-lg max-w-2xl w-full p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Log Details</h3>
                <button
                  @click="selectedLog = null"
                  class="text-gray-500 hover:text-gray-700"
                >
                  <i
                    class="i-heroicons-outline-x h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Timestamp</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ new Date(selectedLog.timestamp).toLocaleString() }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Type</label>
                  <p class="mt-1 text-sm text-gray-900">{{ selectedLog.type }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Project</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ projects.find(p => p.id === selectedLog?.project)?.name || 'N/A' }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Message</label>
                  <p class="mt-1 text-sm text-gray-900">{{ selectedLog.message }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Metadata</label>
                  <pre class="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>
