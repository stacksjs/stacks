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
  const cardWidth = 310 // Card width defined here for consistent reference

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
  const initialScale = 0.6 // Increased zoom by 10%
  svg.call(zoom.transform, d3.zoomIdentity.translate(width/2 - width*initialScale/2, 10).scale(initialScale))

  // Set initial positions for models based on the reference image layout
  const initialPositions: Record<string, {x: number, y: number}> = {
    // Top row - more evenly spaced
    'team': { x: width * 0.1, y: 150 },
    'user': { x: width * 0.5, y: 150 },
    'post': { x: width * 0.8, y: 150 },

    // Second row - better distributed
    'accessToken': { x: width * 0.1, y: 550 }, // Further moved down to avoid overlapping
    'subscriber': { x: width * 0.8, y: 450 },

    // Third row - more evenly spaced
    'project': { x: width * 0.2, y: 1400 },
    'order': { x: width * 0.5, y: 750 },
    'subscriberEmail': { x: width * 0.8, y: 750 },

    // Fourth row - better distributed with more horizontal spacing
    'deployment': { x: width * 0.1, y: 1050 },
    'release': { x: width * 0.35, y: 1050 },
    'orderItem': { x: width * 0.65, y: 1050 }
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
    .data(models)
    .join('g')
    .attr('transform', d => {
      const x = d.posX || width / 2
      const y = d.posY || height / 2
      return `translate(${x - cardWidth/2}, ${y - 40})`
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
        d.posY = y + 40;

        // Update links
        updateLinks();
      })
      .on('end', function(event) {
        if (!event.active && simulation) simulation.alphaTarget(0);
        // Clean up the offset properties
        delete event.subject.dragOffsetX;
        delete event.subject.dragOffsetY;
      }))

  // Add shadow effect to nodes
  node.append('rect')
    .attr('width', cardWidth)
    .attr('height', d => {
      const propsHeight = d.properties.length * 22 // Reduced from 24
      const relationshipsHeight = d.relationships.length > 0 ? (d.relationships.length * 22 + 20) : 0 // Reduced from 24
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
      const relationshipsHeight = d.relationships.length > 0 ? (d.relationships.length * 22 + 20) : 0 // Reduced from 24
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
        .text(prop.name)

      // Property type
      row.append('text')
        .attr('x', cardWidth - 40) // Adjusted for wider card
        .attr('y', 0)
        .attr('dominant-baseline', 'middle') // Improved vertical alignment
        .attr('text-anchor', 'end')
        .attr('fill', '#9CA3AF')
        .attr('font-size', '14px')
        .text(prop.type)

      // Nullable indicator - improved spacing from edge
      row.append('text')
        .attr('x', cardWidth - 16) // Adjusted for better spacing from edge
        .attr('y', 0)
        .attr('dominant-baseline', 'middle') // Improved vertical alignment
        .attr('text-anchor', 'middle')
        .attr('fill', prop.nullable ? '#EF4444' : '#10B981')
        .attr('font-size', '14px')
        .text(prop.nullable ? 'N' : 'U')
    })

    // Add relationships section if there are any
    if (d.relationships.length > 0) {
      const relationshipsY = 36 + d.properties.length * 22 // Adjusted from 40 and 24

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
        .attr('transform', `translate(0, ${relationshipsY + 10})`) // Added 10px margin

      // Add each relationship on its own row
      d.relationships.forEach((rel, i) => {
        const y = 18 + i * 22 // Reduced from 20 and 24
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
          .attr('x', 12)
          .attr('y', -12)
          .attr('width', cardWidth - 24)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', bgColor)
          .attr('fill-opacity', 0.1)
          .attr('stroke', bgColor)
          .attr('stroke-width', 1)

        // Relationship type - improved vertical alignment
        row.append('text')
          .attr('x', 24)
          .attr('y', 0)
          .attr('dominant-baseline', 'middle') // Improved vertical alignment
          .attr('fill', bgColor)
          .attr('font-size', '14px')
          .attr('font-weight', 'bold')
          .text(rel.type + ':')

        // Related model - improved vertical alignment
        row.append('text')
          .attr('x', 120)
          .attr('y', 0)
          .attr('dominant-baseline', 'middle') // Improved vertical alignment
          .attr('fill', '#E5E7EB')
          .attr('font-size', '14px')
          .text(rel.model + (rel.collection ? ` (${rel.collection})` : ''))
      })
    }
  })

  // Create links between nodes
  relationships.forEach(rel => {
    const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id
    const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id

    const sourceModel = models.find(m => m.id === sourceId)
    const targetModel = models.find(m => m.id === targetId)

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
    .attr('transform', `translate(${width - 220}, 50)`) // Moved down more to center vertically
    .attr('class', 'legend')

  // Add legend background for better visibility
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -10)
    .attr('width', 220)
    .attr('height', 120) // Reduced height to balance spacing
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', 'rgba(30, 41, 59, 0.8)') // Dark background with transparency
    .attr('stroke', '#4B5563')
    .attr('stroke-width', 1)

  const relationshipTypes = [
    { type: 'belongsTo', label: 'Belongs To', color: relationshipColors.belongsTo },
    { type: 'hasMany', label: 'Has Many', color: relationshipColors.hasMany },
    { type: 'hasOne', label: 'Has One', color: relationshipColors.hasOne },
    { type: 'belongsToMany', label: 'Belongs To Many', color: relationshipColors.belongsToMany }
  ]

  relationshipTypes.forEach((rel, i) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(10, ${i * 25 + 15})`)

    // Line sample
    legendItem.append('line')
      .attr('x1', 0)
      .attr('y1', 10)
      .attr('x2', 30)
      .attr('y2', 10)
      .attr('stroke', rel.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', rel.type === 'belongsToMany' ? '5,5' : 'none')
      .attr('marker-end', `url(#arrow-${rel.type})`)

    // Label with improved visibility
    legendItem.append('text')
      .attr('x', 40)
      .attr('y', 10)
      .attr('dominant-baseline', 'middle') // Improved vertical alignment
      .attr('fill', '#FFFFFF') // White text for better contrast
      .attr('font-size', '14px')
      .text(rel.label)
  })

  // Create force simulation with fixed positions
  simulation = d3.forceSimulation<ModelNode>(models)
    .alphaDecay(0.02) // Slower decay for smoother animation
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

    const sourceModel = models.find(m => m.id === sourceId)
    const targetModel = models.find(m => m.id === targetId)

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
          <div ref="diagramContainer" class="w-full h-[1200px] bg-gray-50 dark:bg-blue-gray-800 rounded-lg"></div>
        </div>
      </div>
    </div>
  </div>
</template>
