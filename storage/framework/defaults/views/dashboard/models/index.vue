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
  properties: Array<{name: string, type: string, nullable: boolean}>
  relationships: Array<{type: string, model: string}>
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

// Define color palette for models
const colorPalette = {
  primary: '#2563EB',    // Blue
  secondary: '#DB2777',  // Pink
  tertiary: '#0D9488',   // Teal
  quaternary: '#7E22CE', // Purple
  gray: '#4B5563',       // Gray
}

// Model definitions based on actual Models directory
const models: ModelNode[] = [
  {
    id: 'user',
    name: 'User',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'name', type: 'string', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'email_verified_at', type: 'timestamp', nullable: true },
      { name: 'password', type: 'string', nullable: false },
      { name: 'two_factor_secret', type: 'text', nullable: true },
      { name: 'two_factor_recovery_codes', type: 'text', nullable: true },
      { name: 'two_factor_confirmed_at', type: 'timestamp', nullable: true },
      { name: 'remember_token', type: 'string', nullable: true },
      { name: 'current_team_id', type: 'bigInteger', nullable: true },
      { name: 'profile_photo_path', type: 'string', nullable: true },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'hasOne', model: 'Subscriber' },
      { type: 'hasMany', model: 'Deployment' },
      { type: 'hasMany', model: 'Post' },
      { type: 'belongsToMany', model: 'Team' }
    ],
    color: colorPalette.primary
  },
  {
    id: 'team',
    name: 'Team',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'name', type: 'string', nullable: false },
      { name: 'companyName', type: 'string', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'billingEmail', type: 'string', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'description', type: 'string', nullable: false },
      { name: 'isPersonal', type: 'boolean', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsToMany', model: 'User' },
      { type: 'hasMany', model: 'AccessToken' }
    ],
    color: colorPalette.primary
  },
  {
    id: 'post',
    name: 'Post',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'title', type: 'string', nullable: false },
      { name: 'body', type: 'text', nullable: false },
      { name: 'image', type: 'string', nullable: true },
      { name: 'user_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'User' }
    ],
    color: colorPalette.secondary
  },
  {
    id: 'subscriber',
    name: 'Subscriber',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'hasMany', model: 'SubscriberEmail' }
    ],
    color: colorPalette.tertiary
  },
  {
    id: 'subscriberEmail',
    name: 'SubscriberEmail',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'subscriber_id', type: 'bigInteger', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'Subscriber' }
    ],
    color: colorPalette.tertiary
  },
  {
    id: 'accessToken',
    name: 'AccessToken',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'token', type: 'string', nullable: false },
      { name: 'user_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'User' }
    ],
    color: colorPalette.primary
  },
  {
    id: 'deployment',
    name: 'Deployment',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'project_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'Project' }
    ],
    color: colorPalette.secondary
  },
  {
    id: 'project',
    name: 'Project',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'name', type: 'string', nullable: false },
      { name: 'description', type: 'string', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'hasMany', model: 'Deployment' },
      { type: 'hasMany', model: 'Release' }
    ],
    color: colorPalette.secondary
  },
  {
    id: 'release',
    name: 'Release',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'version', type: 'string', nullable: false },
      { name: 'project_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'Project' }
    ],
    color: colorPalette.secondary
  },
  {
    id: 'order_items',
    name: 'OrderItem',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'quantity', type: 'integer', nullable: false },
      { name: 'total', type: 'decimal', nullable: false },
      { name: 'order_id', type: 'bigInteger', nullable: false },
    ],
    relationships: [
      { type: 'belongsTo', model: 'Order' }
    ],
    color: colorPalette.quaternary
  }
]

// Define relationships between models
const relationships: RelationshipLink[] = [
  { source: 'user', target: 'team', type: 'belongsToMany' },
  { source: 'team', target: 'user', type: 'belongsToMany' },
  { source: 'user', target: 'accessToken', type: 'hasMany' },
  { source: 'user', target: 'post', type: 'hasMany' },
  { source: 'post', target: 'user', type: 'belongsTo' },
  { source: 'project', target: 'deployment', type: 'hasMany' },
  { source: 'project', target: 'release', type: 'hasMany' },
  { source: 'deployment', target: 'project', type: 'belongsTo' },
  { source: 'release', target: 'project', type: 'belongsTo' },
  { source: 'subscriber', target: 'subscriberEmail', type: 'hasMany' },
  { source: 'subscriberEmail', target: 'subscriber', type: 'belongsTo' },
  { source: 'order_items', target: 'order', type: 'belongsTo' }
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
    .attr('class', 'dark:bg-blue-gray-800')

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

  // Create nodes
  const node = g.append('g')
    .selectAll('g')
    .data(models)
    .join('g')
    .call(d3.drag<any, ModelNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))

  // Add main rectangles for nodes with color border
  node.append('rect')
    .attr('width', 200)
    .attr('height', d => {
      // Calculate height based on properties and relationships
      const propsHeight = d.properties.length * 24
      const relationshipsHeight = d.relationships.length > 0 ?
        (d.relationships.length * 24) + 10 : 0
      return 60 + propsHeight + relationshipsHeight
    })
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', '#1E293B') // Dark background
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)

  // Add header with model name
  node.append('g')
    .attr('class', 'header')
    .each(function(d) {
      const header = d3.select(this)

      // Header background
      header.append('rect')
        .attr('width', 200)
        .attr('height', 40)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', '#1E293B')

      // Model name
      header.append('text')
        .attr('x', 100)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('fill', '#E5E7EB')
        .attr('font-weight', 'bold')
        .text(d.name)
    })

  // Add properties
  node.each(function(d) {
    const g = d3.select(this)

    // Properties container
    const propertiesGroup = g.append('g')
      .attr('transform', 'translate(0, 40)')

    // Add properties
    d.properties.forEach((prop, i) => {
      const y = 20 + i * 24
      const row = propertiesGroup.append('g')
        .attr('transform', `translate(0, ${y})`)

      // Primary key indicator (yellow dot for id)
      if (prop.name === 'id') {
        row.append('circle')
          .attr('cx', 10)
          .attr('cy', 0)
          .attr('r', 4)
          .attr('fill', '#FCD34D') // Yellow for primary key
      }

      // Property name
      row.append('text')
        .attr('x', 20)
        .attr('y', 0)
        .attr('fill', prop.name === 'id' ? '#FCD34D' : '#E5E7EB')
        .attr('font-size', '14px')
        .text(prop.name)

      // Property type
      row.append('text')
        .attr('x', 180)
        .attr('y', 0)
        .attr('text-anchor', 'end')
        .attr('fill', '#9CA3AF')
        .attr('font-size', '14px')
        .text(prop.type)

      // Nullable indicator
      row.append('text')
        .attr('x', 195)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('fill', prop.nullable ? '#EF4444' : '#10B981')
        .attr('font-size', '14px')
        .text(prop.nullable ? 'N' : 'U')
    })

    // Add relationships section if there are any
    if (d.relationships.length > 0) {
      const relationshipsY = 40 + d.properties.length * 24

      // Add relationship divider line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', relationshipsY)
        .attr('x2', 200)
        .attr('y2', relationshipsY)
        .attr('stroke', '#4B5563')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.3)

      // Relationships container
      const relationshipsGroup = g.append('g')
        .attr('transform', `translate(0, ${relationshipsY})`)

      // Add relationships
      d.relationships.forEach((rel, i) => {
        const y = 20 + i * 24
        const row = relationshipsGroup.append('g')
          .attr('transform', `translate(0, ${y})`)

        // Create colored background for relationship
        const relationshipType = rel.type
        let bgColor = '#EF4444' // Red for belongsTo

        if (relationshipType === 'hasMany') {
          bgColor = '#3B82F6' // Blue for hasMany
        } else if (relationshipType === 'hasOne') {
          bgColor = '#10B981' // Green for hasOne
        } else if (relationshipType === 'belongsToMany') {
          bgColor = '#8B5CF6' // Purple for belongsToMany
        }

        // Add relationship background
        row.append('rect')
          .attr('x', 10)
          .attr('y', -12)
          .attr('width', 180)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', bgColor)
          .attr('fill-opacity', 0.1)
          .attr('stroke', bgColor)
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.3)

        // Relationship type
        row.append('text')
          .attr('x', 20)
          .attr('y', 0)
          .attr('fill', bgColor)
          .attr('font-size', '14px')
          .attr('font-weight', 'bold')
          .text(relationshipType + ':')

        // Related model
        row.append('text')
          .attr('x', 110)
          .attr('y', 0)
          .attr('fill', '#E5E7EB')
          .attr('font-size', '14px')
          .text(rel.model)
      })
    }
  })

  // Create links with gradients
  const link = g.append('g')
    .selectAll('line')
    .data(relationships)
    .join('line')
    .attr('stroke', d => {
      // Color links based on relationship type
      if (d.type === 'hasMany') return '#3B82F6'
      if (d.type === 'hasOne') return '#10B981'
      if (d.type === 'belongsToMany') return '#8B5CF6'
      return '#EF4444' // belongsTo
    })
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', d => d.type === 'belongsToMany' ? '5,5' : 'none')
    .attr('marker-end', 'url(#arrow)')

  // Create force simulation
  simulation = d3.forceSimulation<ModelNode>(models)
    .force('link', d3.forceLink<ModelNode, RelationshipLink>(relationships)
      .id(d => d.id)
      .distance(250))
    .force('charge', d3.forceManyBody()
      .strength(-1000))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(150))
    .force('x', d3.forceX(width / 2).strength(0.1))
    .force('y', d3.forceY(height / 2).strength(0.1))

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => {
        const source = typeof d.source === 'string' ? models.find(m => m.id === d.source) : d.source as ModelNode
        return source?.x || 0
      })
      .attr('y1', d => {
        const source = typeof d.source === 'string' ? models.find(m => m.id === d.source) : d.source as ModelNode
        return source?.y || 0
      })
      .attr('x2', d => {
        const target = typeof d.target === 'string' ? models.find(m => m.id === d.target) : d.target as ModelNode
        return target?.x || 0
      })
      .attr('y2', d => {
        const target = typeof d.target === 'string' ? models.find(m => m.id === d.target) : d.target as ModelNode
        return target?.y || 0
      })

    node
      .attr('transform', d => `translate(${(d.x || 0) - 100},${(d.y || 0) - 40})`)
  })
}

// Drag functions
function dragstarted(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
  if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
  event.subject.fx = event.subject.x
  event.subject.fy = event.subject.y
}

function dragged(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
  event.subject.fx = event.x
  event.subject.fy = event.y
}

function dragended(event: d3.D3DragEvent<SVGGElement, ModelNode, ModelNode>) {
  if (!event.active && simulation) simulation.alphaTarget(0)
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
  if (simulation) simulation.stop()
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
                Data Models
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Visualize your application's data models and relationships.
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
                <div v-else class="i-hugeicons-cloud-download w-4 h-4" />
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
