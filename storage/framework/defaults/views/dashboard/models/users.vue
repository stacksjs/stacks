<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats section -->
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
                Total Users
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                12,345
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                678
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-green-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Active Sessions
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                4,938
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                271
              </p>
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
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">User Growth & Activity</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Track user registrations and active sessions over time</p>
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

    <!-- Model Relationships Diagram -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">User Model Relationships</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Interactive diagram showing User model relationships. Click on any model to view details.</p>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="downloadSVG"
                class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                SVG
              </button>
              <button
                @click="downloadPNG"
                class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PNG
              </button>
            </div>
          </div>
          <div class="flex">
            <div ref="diagramContainer" class="h-[400px] relative flex-1">
              <!-- D3 diagram will be rendered here -->
            </div>

            <div v-if="selectedModel" class="w-64 ml-6 p-4 bg-gray-50 dark:bg-blue-gray-600 rounded-lg">
              <div class="flex items-center mb-4">
                <span class="text-2xl mr-2">{{ selectedModel.emoji }}</span>
                <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedModel.name }}</h4>
              </div>

              <div class="mb-4">
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ selectedModel.description }}</p>
              </div>

              <div class="mb-4">
                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Properties</h5>
                <ul class="space-y-1">
                  <li v-for="prop in selectedModel.properties" :key="prop" class="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {{ prop }}
                  </li>
                </ul>
              </div>

              <div class="mb-6">
                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Relationships</h5>
                <ul class="space-y-1">
                  <li v-for="rel in selectedModel.relationships" :key="rel" class="text-sm font-mono">
                    <router-link
                      :to="getModelRoute(rel.toLowerCase())"
                      class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-150"
                    >
                      {{ rel }}
                    </router-link>
                  </li>
                </ul>
              </div>

              <router-link
                v-if="selectedModel.id !== 'user'"
                :to="getModelRoute(selectedModel.id)"
                class="block w-full text-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm transition-colors duration-150"
              >
                View Details
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Users
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all your project users.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
            Add User
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
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Updated At
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

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0">
                          <img
                            src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                            alt=""
                            class="h-10 w-10 rounded-full"
                          >
                        </div>

                        <div class="ml-4">
                          <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                            Chris Breuer
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-300 dark:text-gray-400">
                            chris@stacksjs.org
                          </div>
                        </div>
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      2024/01/22 11:00am
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      2024/01/02 4:20pm
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Edit<span class="sr-only">, User</span></a>
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
import * as d3 from 'd3'
import { useRouter } from 'vue-router'

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
  title: 'Dashboard - Users',
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
    const daysFromStart = days - 1 - i
    return Math.floor(baseCount + (dailyGrowth * daysFromStart) + dayVariance)
  }).reverse()
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
            if (value >= 1000000) return `${label}${(value / 1000000).toFixed(1)}M users`
            if (value >= 1000) return `${label}${(value / 1000).toFixed(1)}k users`
            return `${label}${value} users`
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
  const baseCount = 2000 // Starting with 2k users
  const dailyGrowth = 20 // Average 20 new users per day

  return {
    labels,
    datasets: [{
      label: 'Total Users',
      data: generateGrowthData(days, baseCount, dailyGrowth),
      borderColor: 'rgb(59, 130, 246)', // Blue color for users
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }, {
      label: 'Active Sessions',
      data: generateGrowthData(days, Math.floor(baseCount * 0.4), Math.floor(dailyGrowth * 0.4)), // ~40% of total users are active
      borderColor: 'rgb(34, 197, 94)', // Green color for active sessions
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
  // Set User as the default selected model
  selectedModel.value = models.find(model => model.id === 'user') || null
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false

  if (!diagramContainer.value) return

  const width = 800
  const height = 400
  const svg = d3.select(diagramContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;')

  // Create arrow marker
  svg.append('defs').selectAll('marker')
    .data(['arrow'])
    .join('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 25)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('fill', '#999')
    .attr('d', 'M0,-5L10,0L0,5')

  // Create the simulation
  simulation = d3.forceSimulation<ModelNode>(models)
    .force('link', d3.forceLink<ModelNode, RelationshipLink>(relationships)
      .id(d => d.id)
      .distance(150))
    .force('charge', d3.forceManyBody().strength(-800))
    .force('center', d3.forceCenter(width / 2, height / 2))

  // Draw the links
  const link = svg.append('g')
    .selectAll('line')
    .data(relationships)
    .join('line')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrow)')

  // Draw the nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(models)
    .join('g')
    .call(d3.drag<SVGGElement, ModelNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .style('cursor', 'pointer') // Add pointer cursor
    .on('click', (event, d) => {
      // Set the selected model
      selectedModel.value = d
      // Navigate to the model's page on double click
      if (event.detail === 2) {
        router.push(getModelRoute(d.id))
      }
    })

  // Add hover effect to nodes
  node.on('mouseover', function() {
    d3.select(this).select('circle')
      .transition()
      .duration(200)
      .attr('r', 22) // Slightly larger on hover
  })
  .on('mouseout', function() {
    d3.select(this).select('circle')
      .transition()
      .duration(200)
      .attr('r', 20) // Back to normal size
  })

  // Add circles for nodes
  node.append('circle')
    .attr('r', 20)
    .attr('fill', d => d.color)

  // Add emojis
  node.append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .text(d => d.emoji)
    .attr('font-size', '20px')

  // Add labels
  node.append('text')
    .attr('dy', 35)
    .attr('text-anchor', 'middle')
    .text(d => d.name)
    .attr('fill', '#374151')
    .attr('font-size', '14px')
    .attr('font-weight', 'bold')

  // Update positions on each tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => (d.source as ModelNode).x!)
      .attr('y1', d => (d.source as ModelNode).y!)
      .attr('x2', d => (d.target as ModelNode).x!)
      .attr('y2', d => (d.target as ModelNode).y!)

    node
      .attr('transform', d => `translate(${d.x},${d.y})`)
  })

  // Drag functions
  function dragstarted(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragended(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
    if (!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }
})

// Get router instance
const router = useRouter()

// Model node interface
interface ModelNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  description: string
  properties: string[]
  relationships: string[]
  emoji: string
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

// Relationship link interface
interface RelationshipLink {
  source: string | ModelNode
  target: string | ModelNode
  type: 'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany'
}

// Add selectedModel ref before the models definition
const selectedModel = ref<ModelNode | null>(null)

// User model and its relationships
const models: ModelNode[] = [
  {
    id: 'user',
    name: 'User',
    description: 'Core user model representing application users with authentication and profile information.',
    properties: ['id', 'name', 'email', 'password'],
    relationships: ['teams', 'accessTokens', 'activities', 'posts'],
    emoji: '👤',
    color: '#2563EB'
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Represents a group of users who collaborate together. Teams can have multiple users and users can belong to multiple teams.',
    properties: ['id', 'name', 'owner_id'],
    relationships: ['users'],
    emoji: '👥',
    color: '#60A5FA'
  },
  {
    id: 'accessToken',
    name: 'AccessToken',
    description: 'Manages API authentication tokens for users. Each token grants specific permissions for API access.',
    properties: ['id', 'token', 'user_id'],
    relationships: ['user'],
    emoji: '🔑',
    color: '#3B82F6'
  },
  {
    id: 'activity',
    name: 'Activity',
    description: 'Tracks user actions and events within the application for analytics and audit purposes.',
    properties: ['id', 'type', 'user_id'],
    relationships: ['user'],
    emoji: '📊',
    color: '#93C5FD'
  },
  {
    id: 'post',
    name: 'Post',
    description: 'User-generated content model for sharing updates, articles, or other text-based content.',
    properties: ['id', 'title', 'content'],
    relationships: ['user'],
    emoji: '📝',
    color: '#BFDBFE'
  }
]

// Define relationships
const relationships: RelationshipLink[] = [
  { source: 'user', target: 'team', type: 'belongsToMany' },
  { source: 'team', target: 'user', type: 'belongsToMany' },
  { source: 'user', target: 'accessToken', type: 'hasMany' },
  { source: 'user', target: 'activity', type: 'hasMany' },
  { source: 'post', target: 'user', type: 'belongsTo' }
]

// Visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<ModelNode, undefined>

// Function to get route path for a model
const getModelRoute = (modelId: string) => {
  const routes: Record<string, string> = {
    user: '/models/users',
    team: '/models/teams',
    teams: '/models/teams',
    accessToken: '/models/access-tokens',
    accessTokens: '/models/access-tokens',
    activity: '/models/activities',
    activities: '/models/activities',
    post: '/models/posts',
    posts: '/models/posts'
  }
  return routes[modelId] || '/models'
}

// Add these functions before the onMounted hook
const downloadSVG = () => {
  if (!diagramContainer.value) return

  const svgElement = diagramContainer.value.querySelector('svg')
  if (!svgElement) return

  // Create a copy of the SVG to modify for download
  const svgClone = svgElement.cloneNode(true) as SVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const svgData = new XMLSerializer().serializeToString(svgClone)
  const blob = new Blob([svgData], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'user-model-relationships.svg'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const downloadPNG = () => {
  if (!diagramContainer.value) return

  const svgElement = diagramContainer.value.querySelector('svg')
  if (!svgElement) return

  // Create a copy of the SVG to modify for download
  const svgClone = svgElement.cloneNode(true) as SVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const svgData = new XMLSerializer().serializeToString(svgClone)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Create an image from the SVG
  const img = new Image()
  const blob = new Blob([svgData], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  img.onload = () => {
    // Set canvas size to match the SVG
    canvas.width = img.width
    canvas.height = img.height

    // Draw white background and the image
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    // Convert to PNG and download
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return
      const pngUrl = URL.createObjectURL(pngBlob)
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = 'user-model-relationships.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')

    URL.revokeObjectURL(url)
  }

  img.src = url
}
</script>

<style scoped>
/* Add these styles for the diagram */
:deep(svg) {
  background-color: transparent;
  border-radius: 0.5rem;
}

:deep(line) {
  stroke-linecap: round;
}

:deep(text) {
  user-select: none;
}

:deep(circle) {
  cursor: pointer;
  transition: r 0.2s ease;
}

:deep(g:hover) text {
  font-weight: bold;
}

/* ... existing styles ... */
</style>
