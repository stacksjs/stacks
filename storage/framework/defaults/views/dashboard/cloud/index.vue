<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Cloud',
})

// Add type for server config values
// type ServerConfigValue = string | number | undefined

// Update ServerConfig interface
interface ServerConfig {
  name: string
  domain: string
  region: string
  type: string
  size: InstanceType
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

// Available options for dropdowns
const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
]

type InstanceType = keyof typeof workerSizes

// Update instance types to match Forge's offerings
const instanceTypes: InstanceType[] = [
  't2.micro',
  't2.small',
  't2.medium',
  't2.large',
  't2.xlarge',
  't2.2xlarge',
  't3.micro',
  't3.small',
  't3.medium',
  't3.large',
  't3.xlarge',
  't3.2xlarge',
  'm5.large',
  'm5.xlarge',
  'm5.4xlarge',
  'm5.2xlarge',
  'm5d.large',
  'm5d.xlarge',
  'c5.large',
  'c5.xlarge',
  'c5.2xlarge',
  'c5.4xlarge',
  'c5.9xlarge',
  't4g.micro',
  't4g.small',
  't4g.medium',
  't4g.large',
  't4g.xlarge',
  't4g.2xlarge',
]

const operatingSystems = [
  'ubuntu-24-lts-x86_64',
  'ubuntu-22-lts-x86_64',
  'ubuntu-20-lts-x86_64',
  'debian-11-x86_64',
  'amazon-linux-2-x86_64',
]

// Update default values
const defaultServerOS = 'ubuntu-24-lts-x86_64'
const defaultBunVersion = 'v1.2.3'

// Update server types descriptions
const serverTypes: ServerType[] = [
  {
    value: 'app',
    label: 'Application Server',
    badges: ['Bun', 'Database', 'Nginx', 'Redis', 'Memcached', 'Search Engine'],
    description: 'These servers are meant to be networked to dedicated cache or database servers.'
  },
  {
    value: 'web',
    label: 'Web Server',
    badges: ['Bun', 'Nginx'],
    description: 'A secure Nginx web server.'
  },
  {
    value: 'worker',
    label: 'Worker Server',
    badges: ['Bun'],
    description: 'A dedicated worker server for processing queued jobs.'
  },
  {
    value: 'cache',
    label: 'Cache Server',
    badges: ['Redis', 'Memcached'],
    description: 'A dedicated cache server for improved performance.'
  },
  {
    value: 'database',
    label: 'Database Server',
    badges: ['Database'],
    description: 'A dedicated database server for your services.'
  },
  {
    value: 'search',
    label: 'Search Server',
    badges: ['Search Engine', 'Nginx'],
    description: 'A dedicated search server for your services.'
  },
  {
    value: 'loadbalancer',
    label: 'Load Balancer',
    badges: ['Nginx'],
    description: 'A load balancer to distribute traffic between two or more servers.'
  }
]

const bunVersions = [
  'v1.2.4',
  'v1.2.3',
  'v1.2.2',
  'v1.2.1',
  'v1.2.0',
]

// State
const activeView = ref<'visual' | 'code'>('visual')
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

// type WorkerSize = keyof typeof workerSizes
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
let simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>

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

// Add toggle edit mode function
const toggleEditMode = (key: string) => {
  editMode.value[key] = !editMode.value[key]
}

// Function to update worker specs when size changes
const updateWorkerSpecs = () => {
  workerConfig.value.specs = workerSizes[workerConfig.value.size]
}

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
  nodes.push({ id: 'user', type: 'user', label: 'User/Client' })

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

// Update drag functions to work with zoom
function dragstarted(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  if (!event.active) simulation.alphaTarget(0.3).restart()
  d.fx = event.x
  d.fy = event.y
}

function dragged(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  d.fx = event.x
  d.fy = event.y
}

function dragended(event: d3.D3DragEvent<SVGGElement, InfraNode, unknown>, d: InfraNode) {
  if (!event.active) simulation.alphaTarget(0)
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
const addServer = () => {
  const id = Object.keys(cloudConfig.value.servers).length + 1
  const key = `app${id}`
  const newServer: ServerConfig = {
    name: `app-${generateServerName('app')}`,
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'app',
    size: 't3.micro' as InstanceType,
    diskSize: 20,
    serverOS: defaultServerOS,
    bunVersion: defaultBunVersion,
    database: 'sqlite',
    databaseName: 'stacks',
    searchEngine: 'meilisearch'
  }
  cloudConfig.value.servers[key] = newServer
  editMode.value[key] = true
}

const removeServer = (key: string) => {
  delete cloudConfig.value.servers[key]
}

// Update server config with proper typing
const updateServerConfig = <T extends keyof ServerConfig>(key: string, field: T, value: ServerConfig[T]) => {
  if (cloudConfig.value.servers[key]) {
    cloudConfig.value.servers[key][field] = value
  }
}

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

// Update save method to reset initial state
const saveWorkerConfig = async () => {
  isSaving.value = true
  saveError.value = null

  try {
    // TODO: Implement actual API call to save worker config
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated API call
    initialWorkerConfig.value = { ...workerConfig.value }
    initialCloudConfig.value = { ...cloudConfig.value }
    hasUnsavedChanges.value = false
    // Show success notification here
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Failed to save worker configuration'
  } finally {
    isSaving.value = false
  }
}

// Add field name formatter
const formatFieldName = (field: string) => {
  return field.charAt(0).toUpperCase() + field.slice(1)
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

// Update server name when type changes
const updateServerName = (server: ServerConfig, type: string) => {
  const prefix = type === 'app' ? 'app' :
    type === 'web' ? 'web' :
    type === 'worker' ? 'worker' :
    type === 'cache' ? 'cache' :
    type === 'database' ? 'db' :
    type === 'search' ? 'search' :
    type === 'loadbalancer' ? 'lb' : 'server'

  server.name = `${prefix}-${generateServerName(type)}`
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
                Cloud Infrastructure
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Design and manage your cloud infrastructure.
              </p>
            </div>
          </div>

          <router-link
            to="/settings/mail"
            class="inline-flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
          >
            <div class="i-hugeicons-cog-6-tooth w-6 h-6"></div>
          </router-link>
        </div>
      </div>

      <!-- Infrastructure Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
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
                  class="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                >
                  <span class="sr-only">Close</span>
                  <div class="h-5 w-5">
                    <span class="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200">×</span>
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

      <!-- Visual Builder -->
      <div v-if="activeView === 'visual'" class="space-y-8">
        <!-- Servers -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Servers</h4>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure your application servers and their specifications.</p>
              </div>
              <div class="flex items-center gap-4">
                <router-link
                  to="servers"
                  class="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                >
                  View All
                  <div class="i-hugeicons-arrow-right-01  w-4 h-4"></div>
                </router-link>
                <button
                  @click="addServer"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline transition-colors duration-200"
                >
                  <span class="text-lg">+</span>
                  Add Server
                </button>
              </div>
            </div>

            <div class="space-y-6">
              <div
                v-for="(server, key) in cloudConfig.servers"
                :key="key"
                class="relative border dark:border-gray-600 rounded-lg p-6 transition-all duration-200"
                :class="{ 'hover:border-blue-200 dark:hover:border-blue-500': editMode[key] }"
              >
                <div class="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    v-if="!editMode[key]"
                    @click="toggleEditMode(key)"
                    class="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/50"
                  >
                    <span class="sr-only">Edit</span>
                    <div class="i-hugeicons-pencil-square w-5 h-5"></div>
                  </button>
                  <template v-else>
                    <button
                      @click="removeServer(key)"
                      class="inline-flex items-center p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200 rounded-md hover:bg-red-50 dark:hover:bg-red-900/50"
                    >
                      <span class="sr-only">Remove</span>
                      <div class="i-hugeicons-trash w-5 h-5"></div>
                    </button>
                    <button
                      @click="toggleEditMode(key)"
                      class="inline-flex items-center p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-200 rounded-md hover:bg-green-50 dark:hover:bg-green-900/50"
                    >
                      <span class="sr-only">Save</span>
                      <div class="i-hugeicons-check w-5 h-5"></div>
                    </button>
                  </template>
                </div>

                <!-- Server Header -->
                <div class="mb-6">
                  <div class="flex items-center gap-4 mb-2">
                    <h5 class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ server.name }}</h5>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="badge in serverTypes.find((t: ServerType) => t.value === server.type)?.badges"
                        :key="badge"
                        class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {{ badge }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div class="i-hugeicons-link w-4 h-4"></div>
                    <p>{{ server.domain }}</p>
                  </div>
                  <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {{ serverTypes.find((t: ServerType) => t.value === server.type)?.description }}
                  </p>
                </div>

                <!-- Server Configuration -->
                <div v-if="!editMode[key]" class="mt-4">
                  <div class="flex items-center gap-2">
                    <div class="i-hugeicons-server w-4 h-4 text-gray-400"></div>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      {{ (workerSizes[server.size as keyof typeof workerSizes].ram / 1024).toFixed(0) }}GB RAM ({{ server.size }})
                    </span>
                    <span class="text-sm text-gray-500 dark:text-gray-400">•</span>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      {{ workerSizes[server.size as keyof typeof workerSizes].vcpu }} vCPUs
                    </span>
                    <span class="text-sm text-gray-500 dark:text-gray-400">•</span>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      64-bit {{ server.size.includes('g.') ? 'ARM' : 'x86' }}
                    </span>
                  </div>
                </div>

                <!-- Edit Form -->
                <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <div class="flex gap-2">
                      <input
                        v-model="server.name"
                        type="text"
                        class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                      >
                      <button
                        @click="server.name = generateServerName(server.type)"
                        type="button"
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors duration-200"
                      >
                        <div class="i-hugeicons-sparkles w-5 h-5"></div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
                    <input
                      v-model="server.domain"
                      type="text"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                    <select
                      v-model="server.region"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option v-for="region in regions" :key="region" :value="region">
                        {{ region }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <div class="relative">
                      <select
                        v-model="server.type"
                        :disabled="!editMode[key]"
                        @change="updateServerName(server, server.type)"
                        class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option v-for="type in serverTypes" :key="type.value" :value="type.value">
                          {{ type.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div v-if="['app', 'web', 'worker'].includes(server.type)">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bun Version</label>
                    <select
                      v-model="server.bunVersion"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option value="" disabled>Select a version</option>
                      <option v-for="version in bunVersions" :key="version" :value="version">
                        {{ version }}
                      </option>
                    </select>
                  </div>
                  <div v-if="!['loadbalancer', 'cache', 'search', 'database'].includes(server.type)">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database</label>
                    <select
                      v-model="server.database"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option value="" v-if="server.type !== 'database'">None</option>
                      <option value="mysql">MySQL</option>
                      <option value="postgresql">PostgreSQL</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </div>
                  <div v-if="server.database && !['loadbalancer', 'cache', 'search'].includes(server.type)">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database Name</label>
                    <input
                      v-model="server.databaseName"
                      type="text"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                      placeholder="my_database"
                    >
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operating System</label>
                    <select
                      v-model="server.serverOS"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option v-for="os in operatingSystems" :key="os" :value="os">
                        {{ os }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Disk Size (GB)</label>
                    <input
                      v-model.number="server.diskSize"
                      type="number"
                      min="1"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                  </div>
                  <div v-if="!['loadbalancer', 'cache', 'search', 'database'].includes(server.type)">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Engine</label>
                    <select
                      v-model="server.searchEngine"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option value="">None</option>
                      <option value="meilisearch">Meilisearch</option>
                      <option value="typesense">Typesense</option>
                    </select>
                  </div>
                  <div class="sm:col-span-2 lg:col-span-3">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Data Script</label>
                    <textarea
                      v-model="server.userData"
                      rows="3"
                      class="block w-full text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 font-mono transition-colors duration-200"
                      placeholder="#!/bin/bash"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
