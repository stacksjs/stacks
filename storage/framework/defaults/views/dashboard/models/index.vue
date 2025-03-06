<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Models',
})

// Model node interface
interface ModelNode extends d3.SimulationNodeDatum {
  id: string
  name: string
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

// ERD node interface
interface ERDNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  columns: string[]
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

// ERD link interface
interface ERDLink {
  source: string | ERDNode
  target: string | ERDNode
  sourceColumn: string
  targetColumn: string
}

// Model definitions with colors and emojis
const models: ModelNode[] = [
  {
    id: 'user',
    name: 'User',
    properties: ['id', 'name', 'email', 'password'],
    relationships: ['teams', 'accessTokens', 'activities'],
    emoji: '👤',
    color: '#2563EB' // blue-600 (parent)
  },
  {
    id: 'team',
    name: 'Team',
    properties: ['id', 'name', 'owner_id'],
    relationships: ['users', 'owner'],
    emoji: '👥',
    color: '#60A5FA' // blue-400
  },
  {
    id: 'project',
    name: 'Project',
    properties: ['id', 'name', 'description'],
    relationships: ['deployments', 'releases'],
    emoji: '📂',
    color: '#DB2777' // pink-600 (parent)
  },
  {
    id: 'deployment',
    name: 'Deployment',
    properties: ['id', 'status', 'project_id'],
    relationships: ['project'],
    emoji: '🚀',
    color: '#F472B6' // pink-400
  },
  {
    id: 'release',
    name: 'Release',
    properties: ['id', 'version', 'project_id'],
    relationships: ['project'],
    emoji: '📦',
    color: '#F9A8D4' // pink-300
  },
  {
    id: 'activity',
    name: 'Activity',
    properties: ['id', 'type', 'user_id'],
    relationships: ['user'],
    emoji: '📊',
    color: '#93C5FD' // blue-300
  },
  {
    id: 'subscriber',
    name: 'Subscriber',
    properties: ['id', 'email', 'status'],
    relationships: ['subscriberEmails'],
    emoji: '📫',
    color: '#0D9488' // teal-600 (parent)
  },
  {
    id: 'subscriberEmail',
    name: 'SubscriberEmail',
    properties: ['id', 'email', 'subscriber_id'],
    relationships: ['subscriber'],
    emoji: '✉️',
    color: '#2DD4BF' // teal-400
  },
  {
    id: 'accessToken',
    name: 'AccessToken',
    properties: ['id', 'token', 'user_id'],
    relationships: ['user'],
    emoji: '🔑',
    color: '#3B82F6' // blue-500
  },
  {
    id: 'post',
    name: 'Post',
    properties: ['id', 'title', 'content'],
    relationships: ['user'],
    emoji: '📝',
    color: '#BFDBFE' // blue-200
  },
  {
    id: 'request',
    name: 'Request',
    properties: ['id', 'method', 'url', 'status'],
    relationships: [],
    emoji: '🌐',
    color: '#7E22CE' // purple-700
  }
]

// Define relationships between models
const relationships: RelationshipLink[] = [
  { source: 'user', target: 'team', type: 'belongsToMany' },
  { source: 'team', target: 'user', type: 'belongsToMany' },
  { source: 'user', target: 'accessToken', type: 'hasMany' },
  { source: 'user', target: 'activity', type: 'hasMany' },
  { source: 'project', target: 'deployment', type: 'hasMany' },
  { source: 'project', target: 'release', type: 'hasMany' },
  { source: 'subscriber', target: 'subscriberEmail', type: 'hasMany' },
  { source: 'post', target: 'user', type: 'belongsTo' },
]

// ERD table definitions based on migrations
const erdNodes: ERDNode[] = [
  {
    id: 'users',
    name: 'users',
    columns: ['id', 'name', 'email', 'password', 'created_at', 'updated_at']
  },
  {
    id: 'teams',
    name: 'teams',
    columns: ['id', 'name', 'owner_id', 'created_at', 'updated_at']
  },
  {
    id: 'team_users',
    name: 'team_users',
    columns: ['team_id', 'user_id']
  },
  {
    id: 'projects',
    name: 'projects',
    columns: ['id', 'name', 'description', 'created_at', 'updated_at']
  },
  {
    id: 'deployments',
    name: 'deployments',
    columns: ['id', 'project_id', 'status', 'created_at', 'updated_at']
  },
  {
    id: 'releases',
    name: 'releases',
    columns: ['id', 'project_id', 'version', 'created_at', 'updated_at']
  },
  {
    id: 'activities',
    name: 'activities',
    columns: ['id', 'user_id', 'type', 'created_at', 'updated_at']
  },
  {
    id: 'subscribers',
    name: 'subscribers',
    columns: ['id', 'email', 'status', 'created_at', 'updated_at']
  },
  {
    id: 'subscriber_emails',
    name: 'subscriber_emails',
    columns: ['id', 'subscriber_id', 'email', 'created_at', 'updated_at']
  },
  {
    id: 'personal_access_tokens',
    name: 'personal_access_tokens',
    columns: ['id', 'user_id', 'token', 'created_at', 'updated_at']
  },
  {
    id: 'posts',
    name: 'posts',
    columns: ['id', 'title', 'content', 'created_at', 'updated_at']
  }
]

// ERD relationships based on foreign keys
const erdLinks: ERDLink[] = [
  { source: 'team_users', target: 'teams', sourceColumn: 'team_id', targetColumn: 'id' },
  { source: 'team_users', target: 'users', sourceColumn: 'user_id', targetColumn: 'id' },
  { source: 'teams', target: 'users', sourceColumn: 'owner_id', targetColumn: 'id' },
  { source: 'deployments', target: 'projects', sourceColumn: 'project_id', targetColumn: 'id' },
  { source: 'releases', target: 'projects', sourceColumn: 'project_id', targetColumn: 'id' },
  { source: 'activities', target: 'users', sourceColumn: 'user_id', targetColumn: 'id' },
  { source: 'subscriber_emails', target: 'subscribers', sourceColumn: 'subscriber_id', targetColumn: 'id' },
  { source: 'personal_access_tokens', target: 'users', sourceColumn: 'user_id', targetColumn: 'id' }
]

// Visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<ModelNode, undefined>

// Add format state
const downloadFormat = ref<'svg' | 'png'>('svg')
const isDownloading = ref(false)

// Update download function to support both formats
const downloadDiagram = async () => {
  if (!diagramContainer.value) {
    console.error('No diagram container found')
    return
  }

  const svg = diagramContainer.value.querySelector('svg')
  if (!svg) {
    console.error('No SVG element found')
    return
  }

  isDownloading.value = true

  try {
    if (downloadFormat.value === 'svg') {
      // SVG download
      const svgData = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = 'model-relationships.svg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } else {
      // PNG download
      const svgData = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Set canvas size to match SVG
      const svgSize = svg.getBoundingClientRect()
      const scale = 2 // For better resolution
      canvas.width = svgSize.width * scale
      canvas.height = svgSize.height * scale

      // Set white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Scale for better resolution
      ctx.scale(scale, scale)

      return new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0)
            const pngUrl = canvas.toDataURL('image/png')

            const link = document.createElement('a')
            link.href = pngUrl
            link.download = 'model-relationships.png'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            URL.revokeObjectURL(url)
            resolve(true)
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => {
          reject(new Error('Failed to load SVG into image'))
        }

        img.src = url
      })
    }
  } catch (error) {
    console.error('Error downloading diagram:', error)
  } finally {
    isDownloading.value = false
  }
}

// Create model diagram
const createDiagram = () => {
  if (!diagramContainer.value) return

  const width = diagramContainer.value.clientWidth
  const height = 800 // Increased height for better spacing

  // Clear existing visualization
  d3.select(diagramContainer.value).selectAll('*').remove()

  // Create SVG
  const svg = d3.select(diagramContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  // Define arrow marker
  svg.append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#9CA3AF')

  // Add zoom behavior
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform.toString())
    })

  svg.call(zoom)

  // Create container for zoomable content
  const g = svg.append('g')

  // Create links with gradients
  const link = g.append('g')
    .selectAll('line')
    .data(relationships)
    .join('line')
    .attr('stroke', '#9CA3AF')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', d => d.type === 'belongsToMany' ? '5,5' : 'none')
    .attr('marker-end', 'url(#arrow)')

  // Create nodes
  const node = g.append('g')
    .selectAll('g')
    .data(models)
    .join('g')
    .call(d3.drag<SVGGElement, ModelNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))

  // Add rectangles for nodes with color
  node.append('rect')
    .attr('width', 200)
    .attr('height', (d) => 80 + d.properties.length * 24)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', 'white')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)

  // Add header rectangle
  node.append('rect')
    .attr('width', 200)
    .attr('height', 40)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', d => d.color)
    .attr('opacity', 0.1)

  // Add emoji and model names
  node.append('text')
    .attr('x', 20)
    .attr('y', 28)
    .attr('font-size', '20px')
    .text(d => d.emoji)

  node.append('text')
    .attr('x', 50)
    .attr('y', 28)
    .attr('fill', '#111827')
    .attr('font-weight', 'bold')
    .text(d => d.name)

  // Add properties with icons
  node.each(function(d) {
    const g = d3.select(this)
    d.properties.forEach((prop, i) => {
      const y = 60 + i * 24

      // Add property icon
      g.append('text')
        .attr('x', 20)
        .attr('y', y)
        .attr('fill', '#6B7280')
        .attr('font-size', '14px')
        .text(() => {
          if (prop.includes('id')) return '🔑'
          if (prop.includes('email')) return '📧'
          if (prop.includes('password')) return '🔒'
          if (prop.includes('name')) return '📝'
          if (prop.includes('status')) return '🔵'
          if (prop.includes('type')) return '🏷️'
          if (prop.includes('content')) return '📄'
          if (prop.includes('url')) return '🔗'
          return '⚡'
        })

      // Add property name
      g.append('text')
        .attr('x', 45)
        .attr('y', y)
        .attr('fill', '#374151')
        .attr('font-size', '14px')
        .text(prop)
    })
  })

  // Create force simulation
  simulation = d3.forceSimulation<ModelNode>(models)
    .force('link', d3.forceLink<ModelNode, RelationshipLink>(relationships)
      .id(d => d.id)
      .distance(150))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        // Stronger repulsion for unrelated nodes
        const hasRelations = relationships.some(r =>
          r.source === d.id || (r.source as ModelNode)?.id === d.id ||
          r.target === d.id || (r.target as ModelNode)?.id === d.id
        )
        return hasRelations ? -800 : -1200
      }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(110))
    .force('x', d3.forceX(width / 2).strength(0.1))
    .force('y', d3.forceY(height / 2).strength(0.1))

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => (d.source as ModelNode).x!)
      .attr('y1', d => (d.source as ModelNode).y!)
      .attr('x2', d => (d.target as ModelNode).x!)
      .attr('y2', d => (d.target as ModelNode).y!)

    node
      .attr('transform', d => `translate(${d.x! - 100},${d.y! - 40})`)
  })
}

// Drag functions
function dragstarted(event: d3.D3DragEvent<SVGGElement, any, any>) {
  if (!event.active) simulation?.alphaTarget(0.3).restart()
  event.subject.fx = event.subject.x
  event.subject.fy = event.subject.y
}

function dragged(event: d3.D3DragEvent<SVGGElement, any, any>) {
  event.subject.fx = event.x
  event.subject.fy = event.y
}

function dragended(event: d3.D3DragEvent<SVGGElement, any, any>) {
  if (!event.active) simulation?.alphaTarget(0)
  event.subject.fx = null
  event.subject.fy = null
}

// Initialize visualization on mount
onMounted(() => {
  createDiagram()

  // Handle window resize
  window.addEventListener('resize', createDiagram)
})

// Clean up on unmount
onUnmounted(() => {
  simulation?.stop()
  window.removeEventListener('resize', createDiagram)
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="i-hugeicons-dashboard-speed-02 w-8 h-8 text-blue-500" />
            <div>
              <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
                Data Visualization
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Visualize your application's data models.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Model Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Entity Relationship Diagram</h4>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                (Drag nodes to rearrange)
              </span>
            </div>
            <div class="inline-flex rounded-md shadow-sm">
              <select
                v-model="downloadFormat"
                class="h-9 text-sm border-0 rounded-l-md bg-white dark:bg-blue-gray-600 py-1.5 pl-3 pr-7 text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
              >
                <option value="svg">SVG</option>
                <option value="png">PNG</option>
              </select>
              <button
                @click="downloadDiagram"
                :disabled="isDownloading"
                class="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-r-md shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <div v-if="isDownloading" class="i-hugeicons-arrow-path w-4 h-4 animate-spin" />
                <div v-else class="i-hugeicons-arrow-down-02-tray w-4 h-4" />
                Download
              </button>
            </div>
          </div>
          <div ref="diagramContainer" class="w-full h-[800px] bg-gray-50 dark:bg-blue-gray-800 rounded-lg"></div>
        </div>
      </div>
    </div>
  </div>
</template>
