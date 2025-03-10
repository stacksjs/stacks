<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Models',
})

// Model node interface
interface ModelNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  emoji: string
  properties: Array<{name: string, type: string, nullable: boolean}>
  relationships: Array<{type: string, model: string, collection?: string}>
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  // Track position for dragging
  posX?: number
  posY?: number
  // Drag offset properties
  dragOffsetX?: number
  dragOffsetY?: number
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

// Define relationship colors
const relationshipColors = {
  belongsTo: '#EF4444',      // Red
  hasMany: '#3B82F6',        // Blue
  hasOne: '#10B981',         // Green
  belongsToMany: '#8B5CF6'   // Purple
}

// Model definitions based on actual Models directory
const models: ModelNode[] = [
  {
    id: 'user',
    name: 'User',
    emoji: '👤',
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
      { type: 'hasMany', model: 'AccessToken' },
      { type: 'belongsToMany', model: 'Team' }
    ],
    color: colorPalette.primary
  },
  {
    id: 'team',
    name: 'Team',
    emoji: '👥',
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
    emoji: '📝',
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
    emoji: '📫',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'User' },
      { type: 'hasMany', model: 'SubscriberEmail' }
    ],
    color: colorPalette.tertiary
  },
  {
    id: 'subscriberEmail',
    name: 'SubscriberEmail',
    emoji: '✉️',
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
    emoji: '🔑',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'token', type: 'string', nullable: false },
      { name: 'user_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'User' },
      { type: 'belongsTo', model: 'Team' }
    ],
    color: colorPalette.primary
  },
  {
    id: 'deployment',
    name: 'Deployment',
    emoji: '🚀',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'project_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'Project' },
      { type: 'belongsTo', model: 'User' }
    ],
    color: colorPalette.secondary
  },
  {
    id: 'project',
    name: 'Project',
    emoji: '📂',
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
    emoji: '📦',
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
    id: 'order',
    name: 'Order',
    emoji: '🛒',
    properties: [
      { name: 'id', type: 'bigInteger', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'total', type: 'decimal', nullable: false },
      { name: 'user_id', type: 'bigInteger', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: true },
      { name: 'updated_at', type: 'timestamp', nullable: true }
    ],
    relationships: [
      { type: 'belongsTo', model: 'User' },
      { type: 'hasMany', model: 'OrderItem' }
    ],
    color: colorPalette.quaternary
  },
  {
    id: 'orderItem',
    name: 'OrderItem',
    emoji: '📋',
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
  // User relationships
  { source: 'user', target: 'team', type: 'belongsToMany' },
  { source: 'user', target: 'accessToken', type: 'hasMany' },
  { source: 'user', target: 'post', type: 'hasMany' },
  { source: 'user', target: 'subscriber', type: 'hasOne' },
  { source: 'user', target: 'deployment', type: 'hasMany' },
  { source: 'user', target: 'order', type: 'hasMany' },

  // Team relationships
  { source: 'team', target: 'user', type: 'belongsToMany' },
  { source: 'team', target: 'accessToken', type: 'hasMany' },

  // Post relationships
  { source: 'post', target: 'user', type: 'belongsTo' },

  // Subscriber relationships
  { source: 'subscriber', target: 'user', type: 'belongsTo' },
  { source: 'subscriber', target: 'subscriberEmail', type: 'hasMany' },

  // SubscriberEmail relationships
  { source: 'subscriberEmail', target: 'subscriber', type: 'belongsTo' },

  // AccessToken relationships
  { source: 'accessToken', target: 'user', type: 'belongsTo' },
  { source: 'accessToken', target: 'team', type: 'belongsTo' },

  // Project relationships
  { source: 'project', target: 'deployment', type: 'hasMany' },
  { source: 'project', target: 'release', type: 'hasMany' },

  // Deployment relationships
  { source: 'deployment', target: 'project', type: 'belongsTo' },
  { source: 'deployment', target: 'user', type: 'belongsTo' },

  // Release relationships
  { source: 'release', target: 'project', type: 'belongsTo' },

  // Order relationships
  { source: 'order', target: 'user', type: 'belongsTo' },
  { source: 'order', target: 'orderItem', type: 'hasMany' },

  // OrderItem relationships
  { source: 'orderItem', target: 'order', type: 'belongsTo' }
]

// Visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<ModelNode, undefined> | null = null

// Add format state
const downloadFormat = ref<'svg' | 'png'>('svg')
const isDownloading = ref(false)

// Add filter and search functionality
const searchQuery = ref('')
const selectedModelType = ref('All')
const modelTypes = computed(() => {
  const types = ['All']
  const uniqueColors = new Set(models.map(model => model.color))
  uniqueColors.forEach(color => {
    const modelsWithColor = models.filter(model => model.color === color)
    if (modelsWithColor.length > 0) {
      // Get the first model with this color to determine the type
      const modelType = getModelTypeByColor(color)
      if (modelType) types.push(modelType)
    }
  })
  return types
})

// Filter models based on search and type
const filteredModels = computed(() => {
  return models.filter(model => {
    const matchesSearch = searchQuery.value === '' ||
      model.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      model.properties.some(prop => prop.name.toLowerCase().includes(searchQuery.value.toLowerCase()))

    const matchesType = selectedModelType.value === 'All' ||
      getModelTypeByColor(model.color) === selectedModelType.value

    return matchesSearch && matchesType
  })
})

// Get model type by color
function getModelTypeByColor(color: string): string {
  switch(color) {
    case colorPalette.primary:
      return 'Authentication'
    case colorPalette.secondary:
      return 'Content'
    case colorPalette.tertiary:
      return 'Communication'
    case colorPalette.quaternary:
      return 'Commerce'
    default:
      return 'Other'
  }
}

// Selected model for details panel
const selectedModel = ref<ModelNode | null>(null)

// Model statistics
const modelStats = computed(() => {
  return {
    totalModels: models.length,
    totalRelationships: relationships.length,
    totalProperties: models.reduce((sum, model) => sum + model.properties.length, 0),
    modelsByType: {
      Authentication: models.filter(m => m.color === colorPalette.primary).length,
      Content: models.filter(m => m.color === colorPalette.secondary).length,
      Communication: models.filter(m => m.color === colorPalette.tertiary).length,
      Commerce: models.filter(m => m.color === colorPalette.quaternary).length
    }
  }
})

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
  const height = 1200 // Further increased height for better vertical spacing
  const cardWidth = 356

  // Clear existing visualization
  d3.select(diagramContainer.value).selectAll('*').remove()

  // Create SVG
  const svg = d3.select(diagramContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'dark:bg-blue-gray-800')

  // Define arrow markers for different relationship types
  const defs = svg.append('defs')

  // Add arrow marker for belongsTo
  defs.append('marker')
    .attr('id', 'arrow-belongsTo')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', relationshipColors.belongsTo)

  // Add arrow marker for hasMany
  defs.append('marker')
    .attr('id', 'arrow-hasMany')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', relationshipColors.hasMany)

  // Add arrow marker for hasOne
  defs.append('marker')
    .attr('id', 'arrow-hasOne')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', relationshipColors.hasOne)

  // Add arrow marker for belongsToMany
  defs.append('marker')
    .attr('id', 'arrow-belongsToMany')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', relationshipColors.belongsToMany)

  // Add zoom behavior
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform.toString())
    })

  svg.call(zoom)

  // Create container for zoomable content
  const g = svg.append('g')

  // Apply initial zoom to see all content
  const initialScale = 0.6
  svg.call(zoom.transform, d3.zoomIdentity.translate(width/2 - width*initialScale/2, 10).scale(initialScale))

  // Set initial positions for models based on the reference image layout
  const initialPositions: Record<string, {x: number, y: number}> = {
    // Top row - more evenly spaced
    'team': { x: width * 0.01, y: 150 },
    'user': { x: width * 0.5, y: 150 },
    'post': { x: width * 0.9, y: -200 },

    // Second row - better distributed
    'accessToken': { x: width * 0.2, y: -200 },
    'subscriber': { x: width * 0.8, y: 450 },

    // Third row - more evenly spaced
    'project': { x: width * 0.2, y: 1500 },
    'order': { x: width * 0.5, y: 800 },
    'subscriberEmail': { x: width * 0.8, y: 800 },

    // Fourth row - better distributed with more horizontal spacing
    'deployment': { x: width * 0.05, y: 700 },
    'release': { x: width * 0.35, y: 1100 },
    'orderItem': { x: width * 0.65, y: 1100 }
  }

  // Apply initial positions to models and store them for dragging
  models.forEach(model => {
    if (initialPositions[model.id]) {
      const pos = initialPositions[model.id]
      if (pos) {
        model.fx = pos.x
        model.fy = pos.y
        // Store position for dragging
        model.posX = pos.x
        model.posY = pos.y
      }
    }
  })

  // Create links container
  const linkGroup = g.append('g')
    .attr('class', 'links')

  // Create nodes container
  const nodeGroup = g.append('g')
    .attr('class', 'nodes')

  // Create nodes
  const node = nodeGroup
    .selectAll('g')
    .data(filteredModels.value)
    .join('g')
    .attr('transform', d => {
      const x = d.posX || width / 2
      const y = d.posY || height / 2
      return `translate(${x - cardWidth/2}, ${y - 25})`
    })
    .attr('cursor', 'move') // Add cursor style to indicate draggable
    .call(d3.drag<any, ModelNode>()
      .on('start', function(event) {
        if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
        // Store the initial mouse position relative to the node
        const currentTransform = d3.select(this).attr('transform');
        const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(currentTransform || '');
        if (match && match[1] && match[2]) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);
          event.subject.dragOffsetX = event.x - x;
          event.subject.dragOffsetY = event.y - y;
        }
      })
      .on('drag', function(event, d) {
        // Calculate position accounting for the initial offset to prevent jumping
        const x = event.x - (d.dragOffsetX || 0);
        const y = event.y - (d.dragOffsetY || 0);

        // Update the visual position of the node
        d3.select(this).attr('transform', `translate(${x}, ${y})`);

        // Update the data position for the node
        d.posX = x + cardWidth/2;
        d.posY = y + 25;

        // Update links
        updateLinks();
      })
      .on('end', function(event) {
        if (!event.active && simulation) simulation.alphaTarget(0);
        // Clean up the offset properties
        delete event.subject.dragOffsetX;
        delete event.subject.dragOffsetY;
      }))
    .on('click', (event, d) => {
      // Set the selected model when clicked
      event.stopPropagation() // Prevent bubbling
      selectedModel.value = d
    })

  // Add shadow effect to nodes
  node.append('rect')
    .attr('width', cardWidth)
    .attr('height', d => {
      const propsHeight = d.properties.length * 22 // Reduced from 24
      const relationshipsHeight = d.relationships.length > 0 ? (d.relationships.length * 30 + 40) : 0 // Increased from 35 to 40
      return 50 + propsHeight + relationshipsHeight // Reduced from 60
    })
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', 'rgba(0, 0, 0, 0.3)')
    .attr('transform', 'translate(3, 3)')
    .style('filter', 'blur(3px)')

  // Add main rectangles for nodes with color border
  node.append('rect')
    .attr('width', cardWidth)
    .attr('height', d => {
      // Calculate height based on properties and relationships with reduced height
      const propsHeight = d.properties.length * 22 // Reduced from 24
      const relationshipsHeight = d.relationships.length > 0 ? (d.relationships.length * 30 + 40) : 0 // Increased from 35 to 40
      return 50 + propsHeight + relationshipsHeight // Reduced from 60
    })
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', '#1E293B') // Dark background
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)

  // Add header with model name and emoji
  node.append('g')
    .attr('class', 'header')
    .each(function(d) {
      const header = d3.select(this)

      // Header background
      header.append('rect')
        .attr('width', cardWidth)
        .attr('height', 36) // Reduced from 40
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', '#1E293B')

      // Emoji
      header.append('text')
        .attr('x', 20)
        .attr('y', 22) // Adjusted from 25
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '18px') // Reduced from 20px
        .text(d.emoji)

      // Model name
      header.append('text')
        .attr('x', 50)
        .attr('y', 22) // Adjusted from 25
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#E5E7EB')
        .attr('font-weight', 'bold')
        .text(d.name)
    })

  // Add properties
  node.each(function(d) {
    const g = d3.select(this)

    // Properties container
    const propertiesGroup = g.append('g')
      .attr('transform', 'translate(0, 36)') // Reduced from 40

    // Add properties
    d.properties.forEach((prop, i) => {
      const y = 18 + i * 22 // Reduced from 20 and 24
      const row = propertiesGroup.append('g')
        .attr('transform', `translate(0, ${y})`)

      // Primary key indicator (yellow dot for id) - fixed vertical alignment
      if (prop.name === 'id') {
        row.append('circle')
          .attr('cx', 12) // Adjusted for better alignment
          .attr('cy', 0)
          .attr('r', 4)
          .attr('fill', '#FCD34D') // Yellow for primary key
      }

      // Property name
      row.append('text')
        .attr('x', 24) // Adjusted for better spacing
        .attr('y', 0)
        .attr('dominant-baseline', 'middle') // Improved vertical alignment
        .attr('fill', prop.name === 'id' ? '#FCD34D' : '#E5E7EB')
        .attr('font-size', '14px')
        .attr('font-family', 'monospace')
        .text(prop.name)

      // Property type
      row.append('text')
        .attr('x', cardWidth - 40) // Adjusted for wider card
        .attr('y', 0)
        .attr('dominant-baseline', 'middle') // Improved vertical alignment
        .attr('text-anchor', 'end')
        .attr('fill', '#9CA3AF')
        .attr('font-size', '14px')
        .attr('font-family', 'monospace')
        .text(prop.type)

      // Nullable indicator - improved spacing from edge
      row.append('text')
        .attr('x', cardWidth - 16) // Adjusted for better spacing from edge
        .attr('y', 0)
        .attr('dominant-baseline', 'middle') // Improved vertical alignment
        .attr('text-anchor', 'middle')
        .attr('fill', prop.nullable ? '#EF4444' : '#10B981')
        .attr('font-size', '14px')
        .attr('font-family', 'monospace')
        .text(prop.nullable ? 'N' : 'U')
    })

    // Add relationships section if there are any
    if (d.relationships.length > 0) {
      const relationshipsY = 36 + d.properties.length * 22 + 15 // Increased margin from 10px to 15px

      // Add relationship divider line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', relationshipsY)
        .attr('x2', cardWidth)
        .attr('y2', relationshipsY)
        .attr('stroke', '#4B5563')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.3)

      // Relationships container - added margin above relationships section
      const relationshipsGroup = g.append('g')
        .attr('transform', `translate(0, ${relationshipsY + 15})`) // Increased margin from 10px to 15px

      // Add each relationship on its own row
      d.relationships.forEach((rel, i) => {
        const y = 18 + i * 30 // Increased spacing between relationships from 22 to 30
        const row = relationshipsGroup.append('g')
          .attr('transform', `translate(0, ${y})`)

        // Create colored background for relationship
        let bgColor = relationshipColors.belongsTo // Default red for belongsTo

        if (rel.type === 'hasMany') {
          bgColor = relationshipColors.hasMany
        } else if (rel.type === 'hasOne') {
          bgColor = relationshipColors.hasOne
        } else if (rel.type === 'belongsToMany') {
          bgColor = relationshipColors.belongsToMany
        }

        // Add relationship background - adjusted to match reference image
        row.append('rect')
          .attr('x', 0)
          .attr('y', -15) // Increased from -12 to -15 for more padding
          .attr('width', cardWidth)
          .attr('height', 30) // Increased from 24 to 30 for more padding
          .attr('fill', bgColor)
          .attr('fill-opacity', 0.1)
          .attr('stroke', bgColor)
          .attr('stroke-width', 1)

        // Relationship type - improved vertical alignment with bold styling
        row.append('text')
          .attr('x', 24)
          .attr('y', 0)
          .attr('dominant-baseline', 'middle')
          .attr('fill', bgColor)
          .attr('font-size', '16px')
          .attr('font-weight', 'bold')
          .attr('font-family', 'monospace')
          .text(rel.type + ':')

        // Related model - improved vertical alignment
        row.append('text')
          .attr('x', 180) // Increased from 160 to 180 for more spacing
          .attr('y', 0)
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#FFFFFF')
          .attr('font-size', '16px')
          .attr('font-weight', 'medium')
          .attr('font-family', 'monospace')
          .text(rel.model)
      })
    }
  })

  // Create links between nodes
  relationships.forEach(rel => {
    const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id
    const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id

    // Only draw links for filtered models
    const sourceModel = filteredModels.value.find(m => m.id === sourceId)
    const targetModel = filteredModels.value.find(m => m.id === targetId)

    if (sourceModel && targetModel && sourceModel.posX && sourceModel.posY && targetModel.posX && targetModel.posY) {
      // Calculate control points for the curve
      const dx = targetModel.posX - sourceModel.posX
      const dy = targetModel.posY - sourceModel.posY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Adjust curve factor based on distance between nodes
      const curveFactor = distance > 500 ? 1.5 : 2.5
      const dr = distance * curveFactor

      // Determine if we need a clockwise or counter-clockwise arc
      const sweep = determineArcSweep(sourceId, targetId);

      // Create curved path
      linkGroup.append('path')
        .attr('d', `M${sourceModel.posX},${sourceModel.posY}A${dr},${dr} 0 0,${sweep} ${targetModel.posX},${targetModel.posY}`)
        .attr('fill', 'none')
        .attr('stroke', () => {
          // Color links based on relationship type
          if (rel.type === 'hasMany') return relationshipColors.hasMany
          if (rel.type === 'hasOne') return relationshipColors.hasOne
          if (rel.type === 'belongsToMany') return relationshipColors.belongsToMany
          return relationshipColors.belongsTo // belongsTo
        })
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', rel.type === 'belongsToMany' ? '5,5' : 'none')
        .attr('marker-end', `url(#arrow-${rel.type})`)
        .attr('opacity', 0.8)
    }
  })

  // Add a legend for relationship types with improved visibility
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 220}, 50)`) // Position in top-right corner
    .attr('class', 'legend')

  // Add legend background for better visibility
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -15)
    .attr('width', 220)
    .attr('height', 160)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', '#4B5563') // Solid gray background
    .attr('stroke', '#4B5563')
    .attr('stroke-width', 1)

  const relationshipTypes = [
    { type: 'belongsTo', label: 'Belongs To', color: relationshipColors.belongsTo },
    { type: 'hasMany', label: 'Has Many', color: relationshipColors.hasMany },
    { type: 'hasOne', label: 'Has One', color: relationshipColors.hasOne },
    { type: 'belongsToMany', label: 'Belongs To Many', color: relationshipColors.belongsToMany }
  ]

  // Calculate exact vertical positioning for perfect centering
  const totalItems = relationshipTypes.length;
  const itemHeight = 25;
  const totalContentHeight = totalItems * itemHeight;
  const containerHeight = 130;
  const startY = (containerHeight - totalContentHeight) / 2;

  relationshipTypes.forEach((rel, i) => {
    const yPosition = startY + (i * itemHeight) + 5; // +5 for fine-tuning

    const legendItem = legend.append('g')
      .attr('transform', `translate(10, ${yPosition})`)

    if (rel.type === 'belongsTo') {
      // Left-pointing arrow for Belongs To
      legendItem.append('line')
        .attr('x1', 0)
        .attr('y1', 12)
        .attr('x2', 30)
        .attr('y2', 12)
        .attr('stroke', rel.color)
        .attr('stroke-width', 2)

      // Arrow head
      legendItem.append('polygon')
        .attr('points', '0,12 8,8 8,16')
        .attr('fill', rel.color)
    }
    else if (rel.type === 'hasMany') {
      // Right-pointing arrow for Has Many
      legendItem.append('line')
        .attr('x1', 0)
        .attr('y1', 12)
        .attr('x2', 30)
        .attr('y2', 12)
        .attr('stroke', rel.color)
        .attr('stroke-width', 2)

      // Arrow head
      legendItem.append('polygon')
        .attr('points', '30,12 22,8 22,16')
        .attr('fill', rel.color)
    }
    else if (rel.type === 'hasOne') {
      // Right-pointing arrow for Has One
      legendItem.append('line')
        .attr('x1', 0)
        .attr('y1', 12)
        .attr('x2', 30)
        .attr('y2', 12)
        .attr('stroke', rel.color)
        .attr('stroke-width', 2)

      // Arrow head
      legendItem.append('polygon')
        .attr('points', '30,12 22,8 22,16')
        .attr('fill', rel.color)
    }
    else if (rel.type === 'belongsToMany') {
      // Left-pointing arrow with dashed line for Belongs To Many
      legendItem.append('line')
        .attr('x1', 0)
        .attr('y1', 12)
        .attr('x2', 30)
        .attr('y2', 12)
        .attr('stroke', rel.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')

      // Arrow head
      legendItem.append('polygon')
        .attr('points', '0,12 8,8 8,16')
        .attr('fill', rel.color)
    }

    // Label with improved visibility
    legendItem.append('text')
      .attr('x', 40)
      .attr('y', 12)
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#FFFFFF') // White text for better contrast
      .attr('font-size', '14px')
      .text(rel.label)
  })

  // Create force simulation with fixed positions
  simulation = d3.forceSimulation<ModelNode>(filteredModels.value)
    .alphaDecay(0.02) // Slower decay for smoother animation

  // Add click handler to clear selection when clicking on the background
  svg.on('click', () => {
    selectedModel.value = null
  })
}

// Helper function to determine arc sweep direction
function determineArcSweep(sourceId: string, targetId: string): number {
  // Define specific pairs that should use counter-clockwise arcs
  const counterClockwisePairs = [
    ['user', 'team'],
    ['team', 'user'],
    ['user', 'post'],
    ['user', 'subscriber'],
    ['user', 'deployment'],
    ['project', 'deployment'],
    ['project', 'release'],
    ['subscriber', 'subscriberEmail'],
    ['order', 'orderItem']
  ];

  // Check if this pair should use counter-clockwise arc
  for (const pair of counterClockwisePairs) {
    if ((sourceId === pair[0] && targetId === pair[1]) ||
        (sourceId === pair[1] && targetId === pair[0])) {
      return 0; // Counter-clockwise
    }
  }

  return 1; // Default to clockwise
}

// Function to update links after dragging
function updateLinks() {
  if (!diagramContainer.value) return

  const svg = d3.select(diagramContainer.value).select('svg')
  const linkGroup = svg.select('.links')

  // Clear existing links
  linkGroup.selectAll('path').remove()

  // Redraw all links
  relationships.forEach(rel => {
    const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id
    const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id

    // Only draw links for filtered models
    const sourceModel = filteredModels.value.find(m => m.id === sourceId)
    const targetModel = filteredModels.value.find(m => m.id === targetId)

    if (sourceModel && targetModel && sourceModel.posX && sourceModel.posY && targetModel.posX && targetModel.posY) {
      // Calculate control points for the curve
      const dx = targetModel.posX - sourceModel.posX
      const dy = targetModel.posY - sourceModel.posY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Adjust curve factor based on distance between nodes
      const curveFactor = distance > 500 ? 1.5 : 2.5
      const dr = distance * curveFactor

      // Determine if we need a clockwise or counter-clockwise arc
      const sweep = determineArcSweep(sourceId, targetId);

      // Create curved path
      linkGroup.append('path')
        .attr('d', `M${sourceModel.posX},${sourceModel.posY}A${dr},${dr} 0 0,${sweep} ${targetModel.posX},${targetModel.posY}`)
        .attr('fill', 'none')
        .attr('stroke', () => {
          // Color links based on relationship type
          if (rel.type === 'hasMany') return relationshipColors.hasMany
          if (rel.type === 'hasOne') return relationshipColors.hasOne
          if (rel.type === 'belongsToMany') return relationshipColors.belongsToMany
          return relationshipColors.belongsTo // belongsTo
        })
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', rel.type === 'belongsToMany' ? '5,5' : 'none')
        .attr('marker-end', `url(#arrow-${rel.type})`)
        .attr('opacity', 0.8)
    }
  })
}

// Watch for changes in filters and search to update diagram
watch([searchQuery, selectedModelType], () => {
  // Use setTimeout to debounce the diagram update
  const timer = setTimeout(() => {
    createDiagram()
  }, 300)

  return () => clearTimeout(timer)
})

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
      <!-- Stats Cards -->
      <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Models</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ modelStats.totalModels }}</dd>
          <dd class="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
            <div class="i-hugeicons-database h-4 w-4 mr-1"></div>
            <span>Application entities</span>
          </dd>
        </div>

        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Properties</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ modelStats.totalProperties }}</dd>
          <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
            <div class="i-hugeicons-check-list h-4 w-4 mr-1"></div>
            <span>Model attributes</span>
          </dd>
        </div>

        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Relationships</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ modelStats.totalRelationships }}</dd>
          <dd class="mt-2 flex items-center text-sm text-purple-600 dark:text-purple-400">
            <div class="i-hugeicons-link-01 h-4 w-4 mr-1"></div>
            <span>Model connections</span>
          </dd>
        </div>

        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Model Categories</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ modelTypes.length - 1 }}</dd>
          <dd class="mt-2 flex items-center text-sm text-orange-600 dark:text-orange-400">
            <div class="i-hugeicons-tag-01 h-4 w-4 mr-1"></div>
            <span>Functional groups</span>
          </dd>
        </div>
      </dl>

      <!-- Search and Filter Controls -->
      <div class="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="relative w-full sm:w-64">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <div class="i-hugeicons-search-01 w-5 h-5 text-gray-400"></div>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-blue-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
            placeholder="Search models or properties..."
          />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto">
          <label for="model-type" class="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by type:</label>
          <select
            id="model-type"
            v-model="selectedModelType"
            class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700"
          >
            <option v-for="type in modelTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>
      </div>

      <!-- Model Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium text-gray-900 dark:text-white">Entity Relationship Diagram</h4>
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
          <div ref="diagramContainer" class="w-full h-[1200px] bg-gray-50 dark:bg-blue-gray-800 rounded-lg"></div>
        </div>
      </div>

      <!-- Selected Model Details Panel -->
      <div v-if="selectedModel" class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{{ selectedModel.emoji }}</span>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ selectedModel.name }} Details</h3>
            </div>
            <button
              @click="selectedModel = null"
              class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <div class="i-hugeicons-x-mark w-5 h-5"></div>
            </button>
          </div>
        </div>
        <div class="px-4 py-5 sm:p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Properties Section -->
            <div>
              <h4 class="text-base font-medium text-gray-900 dark:text-white mb-4">Properties</h4>
              <div class="bg-gray-50 dark:bg-blue-gray-800 rounded-md p-4">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Name</th>
                      <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Type</th>
                      <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nullable</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="prop in selectedModel.properties" :key="prop.name">
                      <td class="px-3 py-2 whitespace-nowrap text-sm font-medium" :class="prop.name === 'id' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'">{{ prop.name }}</td>
                      <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ prop.type }}</td>
                      <td class="px-3 py-2 whitespace-nowrap text-sm">
                        <span :class="prop.nullable ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                          {{ prop.nullable ? 'Yes' : 'No' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Relationships Section -->
            <div>
              <h4 class="text-base font-medium text-gray-900 dark:text-white mb-4">Relationships</h4>
              <div class="bg-gray-50 dark:bg-blue-gray-800 rounded-md p-4">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Type</th>
                      <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Related Model</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="(rel, index) in selectedModel.relationships" :key="index">
                      <td class="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <span :class="{
                          'text-red-600 dark:text-red-400': rel.type === 'belongsTo',
                          'text-blue-600 dark:text-blue-400': rel.type === 'hasMany',
                          'text-green-600 dark:text-green-400': rel.type === 'hasOne',
                          'text-purple-600 dark:text-purple-400': rel.type === 'belongsToMany'
                        }">
                          {{ rel.type }}
                        </span>
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ rel.model }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
