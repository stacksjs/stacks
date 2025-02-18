<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Cloud',
})

// Add type for server config values
type ServerConfigValue = string | number | undefined

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

const instanceTypes = [
  't3.nano',
  't3.micro',
  't3.small',
  't3.medium',
  't3.large',
  't3.xlarge',
  't3.2xlarge',
  'c6a.large',
  'c6a.xlarge',
  'c6a.2xlarge',
  'c6a.4xlarge',
  'm6a.large',
  'm6a.xlarge',
  'm6a.2xlarge',
  'm6a.4xlarge',
  'r6a.large',
  'r6a.xlarge',
  'r6a.2xlarge',
  'r6a.4xlarge',
]

const serverTypes = [
  { value: 'app', label: 'Application Server' },
  { value: 'web', label: 'Web Server' },
  { value: 'worker', label: 'Worker Server' },
  { value: 'cache', label: 'Cache Server' },
  { value: 'search', label: 'Search Server' },
]

const operatingSystems = [
  'ubuntu-20-lts-x86_64',
  'ubuntu-22-lts-x86_64',
  'debian-11-x86_64',
  'amazon-linux-2-x86_64',
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

// Update worker sizes with type safety
const workerSizes = {
  't3.nano': { vcpu: 2, ram: 512 },
  't3.micro': { vcpu: 2, ram: 1024 },
  't3.small': { vcpu: 2, ram: 2048 },
  't3.medium': { vcpu: 2, ram: 4096 },
  't3.large': { vcpu: 2, ram: 8192 },
  't3.xlarge': { vcpu: 4, ram: 16384 },
  't3.2xlarge': { vcpu: 8, ram: 32768 },
  'c6a.large': { vcpu: 2, ram: 4096 },
  'c6a.xlarge': { vcpu: 4, ram: 8192 },
  'c6a.2xlarge': { vcpu: 8, ram: 16384 },
  'c6a.4xlarge': { vcpu: 16, ram: 32768 },
  'm6a.large': { vcpu: 2, ram: 8192 },
  'm6a.xlarge': { vcpu: 4, ram: 16384 },
  'm6a.2xlarge': { vcpu: 8, ram: 32768 },
  'm6a.4xlarge': { vcpu: 16, ram: 65536 },
  'r6a.large': { vcpu: 2, ram: 16384 },
  'r6a.xlarge': { vcpu: 4, ram: 32768 },
  'r6a.2xlarge': { vcpu: 8, ram: 65536 },
  'r6a.4xlarge': { vcpu: 16, ram: 131072 },
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

// CDK code generation
const cdkCode = computed(() => {
  return `import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'

export class StacksInfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // VPC
    const vpc = new ec2.Vpc(this, 'StacksVPC', {
      maxAzs: 2,
    })

    ${cloudConfig.value.useLoadBalancer ? `
    // Load Balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'StacksLB', {
      vpc,
      internetFacing: true,
    })` : ''}

    ${Object.entries(cloudConfig.value.servers).map(([key, server]) => `
    // ${server.name}
    const ${key}Instance = new ec2.Instance(this, '${key}Instance', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.GenericLinuxImage({
        'us-east-1': '${server.serverOS}',
      }),
      userData: ec2.UserData.custom(\`${server.userData}\`),
    })`).join('\n')}
  }
}`
})

// Methods
const addServer = () => {
  const id = Object.keys(cloudConfig.value.servers).length + 1
  cloudConfig.value.servers[`app${id}`] = {
    name: `app-server-${id}`,
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'app',
    size: 't3.micro',
    diskSize: 20,
    serverOS: 'ubuntu-20-lts-x86_64',
  }
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
            <div class="i-heroicons-cog-6-tooth w-6 h-6"></div>
          </router-link>
        </div>
      </div>

      <!-- Infrastructure Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Infrastructure Diagram</h4>
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

      <!-- Worker Configuration -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Worker Configuration</h4>

            <div class="flex items-center gap-4">
              <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">
                {{ saveError }}
              </p>

              <button
                @click="saveWorkerConfig"
                :disabled="isSaving"
                class="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  v-if="isSaving"
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {{ isSaving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                v-model="workerConfig.name"
                type="text"
                class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
              <select
                v-model="workerConfig.size"
                @change="updateWorkerSpecs"
                class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option v-for="(specs, size) in workerSizes" :key="size" :value="size">
                  {{ size }} ({{ specs.vcpu }} vCPU, {{ (specs.ram / 1024).toFixed(1) }}GB RAM)
                </option>
              </select>
            </div>
          </div>

          <!-- Replicas Input -->
          <div class="mt-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Replicas
            </label>
            <div class="flex items-center gap-4">
              <input
                v-model.number="workerConfig.replicas"
                type="number"
                min="1"
                max="12"
                step="1"
                class="block w-24 h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
              <div class="flex-1">
                <input
                  v-model.number="workerConfig.replicas"
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                >
                <div class="flex justify-between mt-1 px-1">
                  <span class="text-xs text-gray-500 dark:text-gray-400 -translate-x-[2px]">1</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 -translate-x-[6px]">3</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 -translate-x-[6px]">6</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 -translate-x-[6px]">9</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 -translate-x-[4px]">12</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Resource Summary -->
          <div class="mt-6 p-4 bg-gray-50 dark:bg-blue-gray-600 rounded-lg">
            <h5 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Total Resources</h5>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">vCPU</p>
                <p class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ (workerConfig.specs.vcpu * workerConfig.replicas).toFixed(2) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">RAM</p>
                <p class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ ((workerConfig.specs.ram * workerConfig.replicas) / 1024).toFixed(1) }}GB
                </p>
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
              <button
                @click="addServer"
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline transition-colors duration-200"
              >
                <span class="text-lg">+</span>
                Add Server
              </button>
            </div>

            <div class="space-y-6">
              <div
                v-for="(server, key) in cloudConfig.servers"
                :key="key"
                class="relative border dark:border-gray-600 rounded-lg p-6 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-500"
              >
                <div class="absolute top-4 right-4">
                  <button
                    @click="removeServer(key)"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                  >
                    <span class="text-lg">×</span>
                    Remove
                  </button>
                </div>

                <div class="mb-6">
                  <h5 class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ server.name }}</h5>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ server.domain }}</p>
                </div>

                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      v-model="server.name"
                      type="text"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
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
                    <select
                      v-model="server.type"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option v-for="type in serverTypes" :key="type.value" :value="type.value">
                        {{ type.label }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
                    <select
                      v-model="server.size"
                      class="block w-full h-10 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                    >
                      <option v-for="size in instanceTypes" :key="size" :value="size">
                        {{ size }} ({{ workerSizes[size].vcpu }} vCPU, {{ (workerSizes[size].ram / 1024).toFixed(1) }}GB RAM)
                      </option>
                    </select>
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

<style scoped>
/* Custom slider styling */
input[type="range"] {
  @apply appearance-none bg-gray-200 dark:bg-gray-700 h-2 rounded-lg;
}

input[type="range"]::-webkit-slider-thumb {
  @apply appearance-none w-6 h-6 bg-blue-600 rounded-full cursor-pointer;
}

input[type="range"]::-moz-range-thumb {
  @apply w-6 h-6 bg-blue-600 rounded-full cursor-pointer border-0;
}

input[type="range"]::-ms-thumb {
  @apply w-6 h-6 bg-blue-600 rounded-full cursor-pointer;
}
</style>
