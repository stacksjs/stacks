<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
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
  title: 'Dashboard - Realtime',
})

const timeRange = ref<'minute' | 'hour' | 'day'>('minute')
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

// Add these new refs
const stats = ref({
  connectionsTriggered: '71,897',
  connectionsChange: '+122',
  avgLatency: '45ms',
  latencyChange: '-12ms',
  successRate: '94.57%',
  successChange: '-3.2%'
})

// Add new refs for app state
const app = ref('Stacks')
const port = ref('6001')
const channelState = ref('Channels current state is unavailable')

// Add event creator refs
const eventChannel = ref('')
const eventName = ref('')
const eventData = ref('')

// WebSocket connection state
const isConnected = ref(false)
const ws = ref<WebSocket | null>(null)
const wsUrl = computed(() => `ws://localhost:${port.value}`)

// Define WebSocket message type
interface WebSocketMessage {
  socket_id?: string
  channel?: string
  event?: string
  data?: unknown
}

// Define event type
interface Event {
  type: string
  socket: string | null
  details: string | null
  time: string
  data?: unknown
  showData?: boolean
}

// Enhanced events list with filtering
const events = ref<Event[]>([])

const eventTypes = computed(() => {
  const types = new Set(events.value.map(e => e.type))
  return Array.from(types)
})

const selectedEventType = ref<string | null>(null)
const searchQuery = ref('')

const filteredEvents = computed(() => {
  let filtered = events.value

  if (selectedEventType.value) {
    filtered = filtered.filter(e => e.type === selectedEventType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(e =>
      e.type.toLowerCase().includes(query) ||
      (e.socket?.toLowerCase().includes(query)) ||
      (e.details?.toLowerCase().includes(query))
    )
  }

  return filtered
})

// Connect to WebSocket
const connect = () => {
  if (ws.value) {
    ws.value.close()
  }

  try {
    ws.value = new WebSocket(wsUrl.value)

    ws.value.onopen = () => {
      isConnected.value = true
      channelState.value = 'Connected to WebSocket server'
      addEvent({
        type: 'connection',
        socket: null,
        details: `Connected to ${wsUrl.value}`,
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
      })
    }

    ws.value.onclose = () => {
      isConnected.value = false
      channelState.value = 'Disconnected from WebSocket server'
      addEvent({
        type: 'disconnection',
        socket: null,
        details: 'WebSocket connection closed',
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
      })
    }

    ws.value.onerror = (error) => {
      channelState.value = 'Error connecting to WebSocket server'
      addEvent({
        type: 'error',
        socket: null,
        details: 'WebSocket connection error',
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
      })
    }

    ws.value.onmessage = (message: MessageEvent) => {
      try {
        const data = JSON.parse(message.data) as WebSocketMessage
        addEvent({
          type: 'message',
          socket: data.socket_id || null,
          details: `Channel: ${data.channel}, Event: ${data.event}`,
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          data: data
        })
      } catch (e) {
        addEvent({
          type: 'message',
          socket: null,
          details: message.data,
          time: new Date().toLocaleTimeString('en-US', { hour12: false })
        })
      }
    }
  } catch (error) {
    channelState.value = 'Failed to connect to WebSocket server'
  }
}

// Disconnect from WebSocket
const disconnect = () => {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
}

// Add event to list with max size limit
const MAX_EVENTS = 1000
const addEvent = (event: any) => {
  events.value.unshift(event)
  if (events.value.length > MAX_EVENTS) {
    events.value = events.value.slice(0, MAX_EVENTS)
  }
}

// Enhanced send event method
const sendEvent = () => {
  if (!ws.value || !eventChannel || !eventName) return

  try {
    const eventMessage = {
      channel: eventChannel.value,
      event: eventName.value,
      data: eventData.value ? JSON.parse(eventData.value) : {}
    }

    ws.value.send(JSON.stringify(eventMessage))

    addEvent({
      type: 'sent',
      socket: null,
      details: `Sent event to channel: ${eventChannel.value}, Event: ${eventName.value}`,
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      data: eventMessage
    })

    // Clear form
    eventChannel.value = ''
    eventName.value = ''
    eventData.value = ''
  } catch (error) {
    addEvent({
      type: 'error',
      socket: null,
      details: 'Failed to send event: ' + (error as Error).message,
      time: new Date().toLocaleTimeString('en-US', { hour12: false })
    })
  }
}

// Connect on mount
onMounted(() => {
  connect()
})

// Cleanup on unmount
onUnmounted(() => {
  disconnect()
})

// Watch for port changes
watch(port, () => {
  if (isConnected.value) {
    disconnect()
    connect()
  }
})

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  realtimeData.value = getRealtimeData()
  isLoading.value = false
})

// Update chart datasets
const getRealtimeData = () => {
  const now = new Date()
  const labels = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(now.getTime() - (59 - i) * 1000)
    return `${d.getMinutes()}:${d.getSeconds().toString().padStart(2, '0')}`
  })

  return {
    labels,
    datasets: [
      {
        label: 'Peak Connections',
        data: Array.from({ length: 60 }, () => Math.floor(Math.random() * 15)),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'WebSocket Messages',
        data: Array.from({ length: 60 }, () => Math.floor(Math.random() * 5)),
        borderColor: 'rgb(245, 158, 11)', // Yellow
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'API Messages',
        data: Array.from({ length: 60 }, () => Math.floor(Math.random() * 2)),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.4,
      }
    ],
  }
}

const realtimeData = ref(getRealtimeData())
const activeConnections = ref([
  { id: '1', client: 'Web Client', status: 'Connected', uptime: '2m 30s', messages: 156 },
  { id: '2', client: 'Mobile App', status: 'Connected', uptime: '15m 12s', messages: 432 },
  { id: '3', client: 'Desktop App', status: 'Connected', uptime: '1h 5m', messages: 1205 },
])
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Last 30 Days Stats -->
      <div class="mb-8">
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-link-03 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Connections Triggered
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ stats.connectionsTriggered }}
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only">Increased by</span>
                {{ stats.connectionsChange }}
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-alarm-clock h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Average Latency
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ stats.avgLatency }}
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only">Decreased by</span>
                {{ stats.latencyChange }}
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-checkmark-circle-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Success Rate
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ stats.successRate }}
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only">Decreased by</span>
                {{ stats.successChange }}
              </p>
            </dd>
          </div>
        </dl>
      </div>

      <!-- App Selector -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-700 dark:text-gray-300">App:</label>
            <input
              v-model="app"
              type="text"
              class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
            >
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-700 dark:text-gray-300">Port:</label>
            <input
              v-model="port"
              type="text"
              class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
            >
          </div>
          <button
            type="button"
            @click="isConnected ? disconnect() : connect()"
            :class="{
              'block rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 text-white': true,
              'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600': isConnected,
              'bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-600': !isConnected,
            }"
          >
            {{ isConnected ? 'Disconnect' : 'Connect' }}
          </button>
        </div>
        <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {{ channelState }}
        </div>
      </div>

      <!-- Realtime Chart -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Realtime Statistics</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Live monitoring of connections and messages</p>
            </div>
          </div>
          <div class="h-[300px] relative">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
            <Line :data="realtimeData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <!-- Event Creator -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Event Creator</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel</label>
              <input
                v-model="eventChannel"
                type="text"
                placeholder="chat.1"
                class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event</label>
              <input
                v-model="eventName"
                type="text"
                placeholder="message.sent"
                class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
              <textarea
                v-model="eventData"
                rows="3"
                placeholder='{"message": "Hello World!", "user_id": 1}'
                class="block w-full text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              ></textarea>
            </div>
            <div class="flex justify-end">
              <button
                @click="sendEvent"
                type="button"
                class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              >
                Send event
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Events List -->
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Events</h3>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-700 dark:text-gray-300">Filter:</label>
                <select
                  v-model="selectedEventType"
                  class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option :value="null">All Events</option>
                  <option v-for="type in eventTypes" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-700 dark:text-gray-300">Search:</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search events..."
                  class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                >
              </div>
              <button
                @click="events = []"
                type="button"
                class="rounded-md bg-gray-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-gray-500 focus-visible:outline-2 focus-visible:outline-gray-600 focus-visible:outline-offset-2"
              >
                Clear
              </button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th scope="col" class="py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold w-32">Type</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold w-48">Socket</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">Details</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold w-32">Time</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                <tr v-for="event in filteredEvents" :key="event.time" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600">
                  <td class="py-4 text-sm font-medium">
                    <span
                      :class="{
                        'inline-flex items-center rounded px-2 py-1 text-xs font-medium': true,
                        'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-100': event.type === 'message',
                        'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100': event.type === 'connection',
                        'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-100': event.type === 'disconnection',
                        'bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100': event.type === 'error',
                        'bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-100': event.type === 'sent'
                      }"
                    >
                      {{ event.type }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {{ event.socket || '-' }}
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div class="font-mono">{{ event.details }}</div>
                    <div v-if="event.data" class="mt-1 text-xs">
                      <button
                        @click="event.showData = !event.showData"
                        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {{ event.showData ? 'Hide Data' : 'Show Data' }}
                      </button>
                      <pre v-if="event.showData" class="mt-2 p-2 bg-gray-50 dark:bg-blue-gray-800 rounded overflow-x-auto">{{ JSON.stringify(event.data, null, 2) }}</pre>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {{ event.time }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
