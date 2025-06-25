<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Servers',
})

// Update ServerConfig interface
interface ServerConfig {
  name: string
  domain: string
  region: string
  type: string
  size: keyof typeof workerSizes
  diskSize: number
  privateNetwork?: string
  subnet?: string
  serverOS: string
  bunVersion?: string
  database?: string
  databaseName?: string
  searchEngine?: string
  userData?: string
}

interface CloudConfig {
  type: string
  useLoadBalancer: boolean
  servers: Record<string, ServerConfig>
}

interface WorkerConfig {
  name: string
  size: keyof typeof workerSizes
  replicas: number
  specs: WorkerSizeSpecs
}

// Add type for server type
interface ServerType {
  value: string
  label: string
  badges: string[]
  description: string
}

type InstanceType = keyof typeof workerSizes

// Update default values
const defaultServerOS = 'ubuntu-24-lts-x86_64'
const defaultBunVersion = 'v1.2.3'
const cloudConfig = ref<CloudConfig>({
  type: 'aws',
  useLoadBalancer: true,
  servers: {
    app: {
      name: 'app-server-1',
      domain: 'stacksjs.org',
      region: 'us-east-1',
      type: 'app',
      size: 't3.micro',
      diskSize: 20,
      privateNetwork: 'vpc-123456789',
      subnet: 'subnet-123456789',
      serverOS: 'ubuntu-20-lts-x86_64',
      bunVersion: '1.1.26',
      database: 'sqlite',
      databaseName: 'stacks',
      userData: '#!/bin/bash\necho "Hello World!" > /tmp/test.txt',
    },
  },
})

// Add node and link type definitions
interface InfraNode extends d3.SimulationNodeDatum {
  id: string
  type: 'user' | 'loadbalancer' | 'server' | 'worker'
  label: string
  config?: ServerConfig | WorkerConfig
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface InfraLink {
  source: string | InfraNode
  target: string | InfraNode
}

// Update worker sizes with accurate specs
const workerSizes = {
  't2.micro': { vcpu: 1, ram: 1024 },
  't2.small': { vcpu: 1, ram: 2048 },
  't2.medium': { vcpu: 2, ram: 4096 },
  't2.large': { vcpu: 2, ram: 8192 },
  't2.xlarge': { vcpu: 4, ram: 16384 },
  't2.2xlarge': { vcpu: 8, ram: 32768 },
  't3.micro': { vcpu: 2, ram: 1024 },
  't3.small': { vcpu: 2, ram: 2048 },
  't3.medium': { vcpu: 2, ram: 4096 },
  't3.large': { vcpu: 2, ram: 8192 },
  't3.xlarge': { vcpu: 4, ram: 16384 },
  't3.2xlarge': { vcpu: 8, ram: 32768 },
  'm5.large': { vcpu: 2, ram: 8192 },
  'm5.xlarge': { vcpu: 4, ram: 16384 },
  'm5.4xlarge': { vcpu: 16, ram: 65536 },
  'm5.2xlarge': { vcpu: 8, ram: 32768 },
  'm5d.large': { vcpu: 2, ram: 8192 },
  'm5d.xlarge': { vcpu: 4, ram: 16384 },
  'c5.large': { vcpu: 2, ram: 4096 },
  'c5.xlarge': { vcpu: 4, ram: 8192 },
  'c5.2xlarge': { vcpu: 8, ram: 16384 },
  'c5.4xlarge': { vcpu: 16, ram: 32768 },
  'c5.9xlarge': { vcpu: 36, ram: 73728 },
  't4g.micro': { vcpu: 2, ram: 1024 },
  't4g.small': { vcpu: 2, ram: 2048 },
  't4g.medium': { vcpu: 2, ram: 4096 },
  't4g.large': { vcpu: 2, ram: 8192 },
  't4g.xlarge': { vcpu: 4, ram: 16384 },
  't4g.2xlarge': { vcpu: 8, ram: 32768 },
} as const

type WorkerSize = keyof typeof workerSizes
type WorkerSizeSpecs = {
  vcpu: number
  ram: number
}

// Add worker state
const workerConfig = ref<WorkerConfig>({
  name: 'Worker 1',
  size: 't3.micro',
  replicas: 1,
  specs: workerSizes['t3.micro'],
})

// Add visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
let simulation: d3.Simulation<InfraNode, undefined> | undefined

// Add zoom state
let zoomGroup: d3.Selection<SVGGElement, unknown, null, undefined>

// Add selected node state
const selectedNode = ref<InfraNode | null>(null)

// Add save state
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Add unsaved state
const hasUnsavedChanges = ref(false)

// Add initial state tracking for change detection
const initialWorkerConfig = ref({ ...workerConfig.value })
const initialCloudConfig = ref({ ...cloudConfig.value })

// Add edit mode state
const editMode = ref<Record<string, boolean>>({})

// Update watch to compare with initial state
watch([cloudConfig, workerConfig], ([newCloud, newWorker]) => {
  hasUnsavedChanges.value = JSON.stringify(newCloud) !== JSON.stringify(initialCloudConfig.value) ||
    JSON.stringify(newWorker) !== JSON.stringify(initialWorkerConfig.value)
  if (diagramContainer.value) {
    updateVisualization()
  }
}, { deep: true })

// Function to create and update the infrastructure visualization
const updateVisualization = () => {
  if (!diagramContainer.value) return

  const width = diagramContainer.value.clientWidth
  const height = 400

  // Clear existing visualization
  d3.select(diagramContainer.value).selectAll('*').remove()

  // Create SVG
  svg = d3.select(diagramContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  // Add zoom behavior
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      zoomGroup.attr('transform', event.transform.toString())
    })

  svg.call(zoom)

  // Add zoom group that will contain all elements
  zoomGroup = svg.append('g')

  // Create nodes data
  const nodes: InfraNode[] = []
  const links: InfraLink[] = []

  // Add user/client node
  nodes.push({ id: 'user', type: 'user', label: 'DNS' })

  // Add load balancer if enabled
  if (cloudConfig.value.useLoadBalancer) {
    nodes.push({ id: 'lb', type: 'loadbalancer', label: 'Load Balancer' })
    links.push({ source: 'user', target: 'lb' })
  }

  // Add servers
  Object.entries(cloudConfig.value.servers).forEach(([key, server]) => {
    nodes.push({ id: key, type: 'server', label: server.name, config: server })
    if (cloudConfig.value.useLoadBalancer) {
      links.push({ source: 'lb', target: key })
    } else {
      links.push({ source: 'user', target: key })
    }
  })

  // Add worker replicas
  for (let i = 0; i < workerConfig.value.replicas; i++) {
    const workerId = `worker-${i}`
    nodes.push({
      id: workerId,
      type: 'worker',
      label: `${workerConfig.value.name} #${i + 1}`,
      config: workerConfig.value
    })
    // Connect workers to the first app server if it exists
    const servers = cloudConfig.value.servers
    const appServer = Object.keys(servers).find(key => servers[key]?.type === 'app')
    if (appServer) {
      links.push({ source: appServer, target: workerId })
    }
  }

  // Create force simulation with proper typing
  simulation = d3.forceSimulation<InfraNode>(nodes)
    .force('link', d3.forceLink<InfraNode, InfraLink>(links)
      .id(d => d.id)
      .distance(150)
      .strength(1))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('x', d3.forceX<InfraNode>(d => {
      switch (d.type) {
        case 'user': return width * 0.2
        case 'loadbalancer': return width * 0.4
        case 'server': return width * 0.6
        case 'worker': return width * 0.8
        default: return width * 0.5
      }
    }).strength(0.8))
    .force('y', d3.forceY<InfraNode>(d => {
      if (d.type === 'server' || d.type === 'worker') {
        const index = nodes.filter(n => n.type === 'server' || n.type === 'worker').indexOf(d)
        return (height / 2) + (index * 40) - (nodes.length * 10)
      }
      return height / 2
    }).strength(0.8))
    .force('collision', d3.forceCollide<InfraNode>().radius(40))

  // Create links
  const link = zoomGroup.append('g')
    .selectAll<SVGLineElement, InfraLink>('line')
    .data(links)
    .join('line')
    .attr('stroke', '#D1D5DB') // gray-300 for better visibility
    .attr('stroke-opacity', 0.8)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,4')

  // Create nodes
  const node = zoomGroup.append('g')
    .selectAll<SVGGElement, InfraNode>('g')
    .data(nodes)
    .join('g')
    .call(d3.drag<SVGGElement, InfraNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event: MouseEvent, d: InfraNode) => {
      event.stopPropagation()
      showNodeDetails(d)
    })

  // Add circles for nodes
  node.append('circle')
    .attr('r', 30)
    .attr('fill', (d: InfraNode) => {
      switch (d.type) {
        case 'user': return '#FCE7F3' // pink-100
        case 'loadbalancer': return '#DBEAFE' // blue-100
        case 'server': return '#D1FAE5' // green-100
        case 'worker': return '#FEF3C7' // yellow-100
        default: return '#F3F4F6' // gray-100
      }
    })
    .attr('stroke', (d: InfraNode) => {
      switch (d.type) {
        case 'user': return '#EC4899' // pink-500
        case 'loadbalancer': return '#3B82F6' // blue-500
        case 'server': return '#10B981' // green-500
        case 'worker': return '#F59E0B' // yellow-500
        default: return '#6B7280' // gray-500
      }
    })
    .attr('stroke-width', 3)

  // Add icons with colored backgrounds
  node.append('circle')
    .attr('r', 20)
    .attr('fill', (d: InfraNode) => {
      switch (d.type) {
        case 'user': return '#BE185D' // pink-700
        case 'loadbalancer': return '#1D4ED8' // blue-700
        case 'server': return '#047857' // green-700
        case 'worker': return '#B45309' // yellow-700
        default: return '#374151' // gray-700
      }
    })

  // Add icons
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 7)
    .attr('fill', '#fff')
    .attr('font-size', '18px')
    .attr('font-family', 'sans-serif')
    .text((d: InfraNode) => {
      switch (d.type) {
        case 'user': return '👥'
        case 'loadbalancer': return '⚖️'
        case 'server': return '🖥️'
        case 'worker': return '⚙️'
        default: return '📦'
      }
    })

  // Update labels with better contrast
  node.append('text')
    .text((d: InfraNode) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', 50)
    .attr('fill', '#1F2937') // gray-800
    .attr('font-size', '12px')
    .attr('font-weight', '500')

  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', (d: InfraLink) => (d.source as InfraNode).x ?? 0)
      .attr('y1', (d: InfraLink) => (d.source as InfraNode).y ?? 0)
      .attr('x2', (d: InfraLink) => (d.target as InfraNode).x ?? 0)
      .attr('y2', (d: InfraLink) => (d.target as InfraNode).y ?? 0)

    node
      .attr('transform', (d: InfraNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
  })

  // Add zoom controls
  const zoomControls = svg.append('g')
    .attr('class', 'zoom-controls')
    .attr('transform', `translate(${width - 100}, 20)`)

  // Zoom in button
  zoomControls.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 30)
    .attr('height', 30)
    .attr('rx', 4)
    .attr('fill', '#374151')
    .attr('cursor', 'pointer')
    .on('click', () => {
      svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 1.3)
    })

  zoomControls.append('text')
    .attr('x', 15)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', '18px')
    .text('+')
    .attr('pointer-events', 'none')

  // Zoom out button
  zoomControls.append('rect')
    .attr('x', 40)
    .attr('y', 0)
    .attr('width', 30)
    .attr('height', 30)
    .attr('rx', 4)
    .attr('fill', '#374151')
    .attr('cursor', 'pointer')
    .on('click', () => {
      svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 0.7)
    })

  zoomControls.append('text')
    .attr('x', 55)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', '18px')
    .text('−')
    .attr('pointer-events', 'none')

  // Reset zoom button
  zoomControls.append('rect')
    .attr('x', 0)
    .attr('y', 40)
    .attr('width', 70)
    .attr('height', 30)
    .attr('rx', 4)
    .attr('fill', '#374151')
    .attr('cursor', 'pointer')
    .on('click', () => {
      svg.transition()
        .duration(300)
        .call(zoom.transform, d3.zoomIdentity)
    })

  zoomControls.append('text')
    .attr('x', 35)
    .attr('y', 60)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', '12px')
    .text('Reset')
    .attr('pointer-events', 'none')

  // Add click handler to clear selection when clicking background
  svg.on('click', () => {
    selectedNode.value = null
  })
}

// Update drag functions to handle undefined simulation
function dragstarted(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
  d.fx = event.x
  d.fy = event.y
}

function dragged(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  d.fx = event.x
  d.fy = event.y
}

function dragended(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  if (!event.active && simulation) simulation.alphaTarget(0)
  d.fx = null
  d.fy = null
}

// Clean up
onUnmounted(() => {
  if (simulation) {
    simulation.stop()
  }
})

// Initialize visualization on mount
onMounted(() => {
  if (diagramContainer.value) {
    updateVisualization()
  }
})

// Methods
// Function to show node details
const showNodeDetails = (node: InfraNode) => {
  selectedNode.value = node
}

// Function to format config details
const formatConfigDetails = (config: ServerConfig | WorkerConfig) => {
  if ('serverOS' in config) {
    // Server config
    return {
      'Server Name': config.name,
      'Domain': config.domain,
      'Region': config.region,
      'Type': config.type,
      'Size': config.size,
      'Disk Size': `${config.diskSize}GB`,
      'OS': config.serverOS,
    }
  } else {
    // Worker config
    return {
      'Worker Name': config.name,
      'Size': config.size,
      'Replicas': config.replicas,
      'vCPU': config.specs.vcpu,
      'RAM': `${config.specs.ram}MB`,
    }
  }
}

// Add these functions after the formatFieldName function
const adjectives = [
  'weathered', 'cosmic', 'stellar', 'quantum', 'nebula', 'astral', 'galactic', 'lunar', 'solar', 'celestial',
  'mystic', 'ethereal', 'void', 'nova', 'pulsar', 'quasar', 'cosmic', 'starlit', 'orbital', 'meteor',
  'ancient', 'blazing', 'crystal', 'digital', 'electric', 'fusion', 'glowing', 'hyper', 'infinite', 'kinetic',
  'luminous', 'magnetic', 'neon', 'omega', 'plasma', 'radiant', 'sonic', 'temporal', 'ultra', 'virtual',
  'wild', 'xenon', 'zero', 'atomic', 'binary', 'cyber', 'dynamic', 'eternal', 'flux', 'gamma'
]

const nouns = [
  'galaxy', 'nebula', 'star', 'comet', 'aurora', 'horizon', 'nova', 'zenith', 'cosmos', 'orbit',
  'vertex', 'prism', 'nexus', 'cipher', 'matrix', 'beacon', 'pulse', 'echo', 'flux', 'core',
  'aegis', 'blade', 'cloud', 'dawn', 'edge', 'forge', 'grid', 'helix', 'iris', 'jade',
  'knight', 'light', 'mist', 'node', 'oasis', 'path', 'quark', 'rift', 'sage', 'titan',
  'unity', 'vortex', 'wave', 'xray', 'yeti', 'zephyr', 'atlas', 'byte', 'crest', 'delta'
]

const generateServerName = (type: string) => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj}-${noun}`
}

// Update the updateServerDefaults function
const updateServerDefaults = (server: ServerConfig) => {
  // Reset database and search engine based on server type
  if (server.type === 'web') {
    server.database = ''
    server.searchEngine = ''
  } else if (server.type === 'loadbalancer' || server.type === 'cache') {
    server.database = ''
    server.searchEngine = ''
    server.bunVersion = ''
  } else if (server.type === 'database') {
    server.searchEngine = ''
    server.bunVersion = ''
    server.database = server.database || 'sqlite'
    server.databaseName = server.databaseName || 'stacks'
  } else if (server.type === 'search') {
    server.database = ''
    server.databaseName = ''
    server.bunVersion = ''
    server.searchEngine = server.searchEngine || 'meilisearch'
  }
}

// Add a watcher for server type changes
watch(() => Object.values(cloudConfig.value.servers), (servers) => {
  servers.forEach(server => {
    updateServerDefaults(server)
  })
}, { deep: true })

interface ServerConfig {
  name: string
  domain: string
  region: string
  type: string
  size: string
  diskSize: number
  privateNetwork?: string
  subnet?: string
  serverOS: string
  bunVersion?: string
  database?: string
  databaseName?: string
  searchEngine?: string
  userData?: string
}

const servers = ref<Record<string, ServerConfig>>({
  app1: {
    name: 'app-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'app',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
    database: 'sqlite',
    databaseName: 'stacks',
    searchEngine: 'meilisearch'
  },
  worker1: {
    name: 'worker-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'worker',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
  },
  worker2: {
    name: 'worker2-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'worker',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
  },
  worker3: {
    name: 'worker3-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'worker',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
  },
  cache1: {
    name: 'cache-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'cache',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
  },
  database1: {
    name: 'database-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'database',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
  },
  search1: {
    name: 'search-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'search',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.4',
  },
})

const sortKey = ref<keyof ServerConfig>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const setSorting = (key: keyof ServerConfig) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

const sortedServers = computed(() => {
  return Object.entries(servers.value).sort(([, a], [, b]) => {
    const aValue = a[sortKey.value]
    const bValue = b[sortKey.value]

    if (!aValue || !bValue || aValue === bValue) return 0
    if (sortOrder.value === 'asc')
      return aValue < bValue ? -1 : 1

    return aValue < bValue ? 1 : -1
  })
})

const searchQuery = ref('')
const filteredServers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return sortedServers.value

  return sortedServers.value.filter(([, server]) => {
    return (
      server.name.toLowerCase().includes(query) ||
      server.domain.toLowerCase().includes(query) ||
      server.type.toLowerCase().includes(query) ||
      server.region.toLowerCase().includes(query)
    )
  })
})

// Add server events interface and mock data
interface ServerEvent {
  id: string
  service: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: string
}

const serverEvents = ref<ServerEvent[]>([
  {
    id: '1',
    service: 'App Server',
    type: 'success',
    message: 'Server deployment completed successfully',
    timestamp: '2024-03-21 14:23:45'
  },
  {
    id: '2',
    service: 'Worker',
    type: 'info',
    message: 'New worker instance launched',
    timestamp: '2024-03-21 14:20:12'
  },
  {
    id: '3',
    service: 'Database',
    type: 'warning',
    message: 'High CPU utilization detected',
    timestamp: '2024-03-21 14:15:30'
  },
  {
    id: '4',
    service: 'Cache',
    type: 'error',
    message: 'Connection timeout',
    timestamp: '2024-03-21 14:10:55'
  },
  {
    id: '5',
    service: 'Search',
    type: 'success',
    message: 'Index rebuilt successfully',
    timestamp: '2024-03-21 14:05:22'
  }
])

const getEventTypeColor = (type: string) => {
  switch (type) {
    case 'success': return 'text-green-400'
    case 'error': return 'text-red-400'
    case 'warning': return 'text-yellow-400'
    default: return 'text-blue-400'
  }
}

const getEventTypeIcon = (type: string) => {
  switch (type) {
    case 'success': return 'i-hugeicons-check-circle'
    case 'error': return 'i-hugeicons-x-circle'
    case 'warning': return 'i-hugeicons-exclamation-triangle'
    default: return 'i-hugeicons-information-circle'
  }
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div>
              <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
                Servers
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Manage all your application servers.
              </p>
            </div>
          </div>

          <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
              Add Server
            </button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="mb-6">
        <div class="flex items-center gap-4">
          <div class="flex-1">
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <div class="i-hugeicons-search-01 w-5 h-5 text-gray-400"></div>
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search servers..."
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-blue-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Servers Table -->
      <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-blue-gray-800">
              <tr>
                <th
                  v-for="header in ['Name', 'Type', 'Region', 'Size', 'OS', 'Database', 'Search']"
                  :key="header"
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  @click="setSorting(header.toLowerCase() as keyof ServerConfig)"
                >
                  <div class="flex items-center gap-1">
                    {{ header }}
                    <div
                      v-if="sortKey === header.toLowerCase()"
                      class="w-4 h-4"
                      :class="sortOrder === 'asc' ? 'i-hugeicons-chevron-up' : 'i-hugeicons-chevron-down'"
                    ></div>
                  </div>
                </th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
              <tr v-for="[key, server] in filteredServers" :key="key" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ server.name }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': server.type === 'app',
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300': server.type === 'web',
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': server.type === 'worker',
                      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300': server.type === 'cache',
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': server.type === 'database',
                      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300': server.type === 'search',
                    }"
                  >
                    {{ server.type }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.region }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.size }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.serverOS }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.database || 'None' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.searchEngine || 'None' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end gap-4">
                    <router-link
                      :to="`/servers/${key}`"
                      class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      View
                    </router-link>
                    <router-link
                      :to="`/servers/${key}`"
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Infrastructure Diagram -->
      <div class="my-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Cloud Diagram</h4>
              <!-- AWS Icon -->
              <div class="flex items-center justify-center w-8 h-8 text-[#FF9900]">
                <div class="i-hugeicons-amazon w-6 h-6"></div>
              </div>
              <span v-if="hasUnsavedChanges" class="text-sm text-amber-600 dark:text-amber-400 ml-2">(Unsaved changes)</span>
            </div>
          </div>
          <div class="relative">
            <div ref="diagramContainer" class="w-full h-[400px] bg-blue-gray-800 rounded-lg"></div>

            <!-- Node Details Panel -->
            <div
              v-if="selectedNode"
              class="absolute top-4 right-4 w-80 bg-white dark:bg-blue-gray-700 rounded-lg shadow-lg p-4 z-10"
              @click.stop
            >
              <div class="flex items-center justify-between mb-4">
                <h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ selectedNode.label }}
                </h5>
                <button
                  @click="selectedNode = null"
                  class="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 transition-colors duration-150"
                >
                  <span class="sr-only">Close</span>
                  <div class="h-5 w-5">
                    <span class="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 transition-colors duration-150">×</span>
                  </div>
                </button>
              </div>

              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center"
                    :class="{
                      'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300': selectedNode.type === 'user',
                      'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': selectedNode.type === 'loadbalancer',
                      'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300': selectedNode.type === 'server',
                      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300': selectedNode.type === 'worker',
                    }"
                  >
                    <span class="text-lg">
                      {{ selectedNode.type === 'user' ? '👤' : selectedNode.type === 'loadbalancer' ? '⚖️' : selectedNode.type === 'server' ? '🖥️' : '⚙️' }}
                    </span>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Type</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) }}
                    </p>
                  </div>
                </div>

                <template v-if="selectedNode.config">
                  <div
                    v-for="(value, key) in formatConfigDetails(selectedNode.config)"
                    :key="key"
                    class="flex justify-between py-2 border-t border-gray-100 dark:border-gray-600"
                  >
                    <span class="text-sm text-gray-500 dark:text-gray-400">{{ key }}</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ value }}</span>
                  </div>
                </template>

                <div v-else-if="selectedNode.type === 'user'" class="text-sm text-gray-500 dark:text-gray-400">
                  Entry point for all incoming traffic to your infrastructure.
                </div>
                <div v-else-if="selectedNode.type === 'loadbalancer'" class="text-sm text-gray-500 dark:text-gray-400">
                  Distributes incoming traffic across multiple servers for improved reliability and performance.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Events -->
      <div>
        <div class="flex justify-between items-center mb-8 mt-16">
          <div>
            <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
              Recent Events
            </h3>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Latest server events and notifications.
            </p>
          </div>
        </div>

        <div class="inline-block min-w-full align-middle">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead class="bg-gray-50 dark:bg-blue-gray-600">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Type</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Service</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Message</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-700">
                <tr v-for="event in serverEvents" :key="event.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="flex items-center">
                      <div :class="[getEventTypeIcon(event.type), getEventTypeColor(event.type), 'w-5 h-5']" />
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {{ event.service }}
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {{ event.message }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                    {{ event.timestamp }}
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
