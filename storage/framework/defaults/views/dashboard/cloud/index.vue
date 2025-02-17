<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import MonacoEditor from '../../../components/MonacoEditor.vue'
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
  size: string
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
  size: 'Small' | 'Medium' | 'Large'
  replicas: number
  specs: {
    vcpu: number
    ram: number
  }
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
  type: 'loadbalancer' | 'server' | 'worker'
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
  Small: { vcpu: 0.25, ram: 512 },
  Medium: { vcpu: 0.5, ram: 1024 },
  Large: { vcpu: 1, ram: 2048 },
} as const

type WorkerSize = keyof typeof workerSizes
type WorkerSizeSpecs = {
  vcpu: number
  ram: number
}

// Update WorkerConfig interface
interface WorkerConfig {
  name: string
  size: WorkerSize
  replicas: number
  specs: WorkerSizeSpecs
}

// Add worker state
const workerConfig = ref<WorkerConfig>({
  name: 'Worker 1',
  size: 'Small',
  replicas: 1,
  specs: workerSizes.Small,
})

// Add visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
let simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>

// Add zoom state
let zoomGroup: d3.Selection<SVGGElement, unknown, null, undefined>

// Function to update worker specs when size changes
const updateWorkerSpecs = () => {
  workerConfig.value.specs = workerSizes[workerConfig.value.size]
}

// Watch for changes that affect the visualization
watch([cloudConfig, workerConfig], () => {
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

  // Add load balancer if enabled
  if (cloudConfig.value.useLoadBalancer) {
    nodes.push({ id: 'lb', type: 'loadbalancer', label: 'Load Balancer' })
  }

  // Add servers
  Object.entries(cloudConfig.value.servers).forEach(([key, server]) => {
    nodes.push({ id: key, type: 'server', label: server.name, config: server })
    if (cloudConfig.value.useLoadBalancer) {
      links.push({ source: 'lb', target: key })
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
    .force('link', d3.forceLink<InfraNode, InfraLink>(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody<InfraNode>().strength(-300))
    .force('center', d3.forceCenter<InfraNode>(width / 2, height / 2))
    .force('collision', d3.forceCollide<InfraNode>().radius(50))

  // Create links
  const link = zoomGroup.append('g')
    .selectAll<SVGLineElement, InfraLink>('line')
    .data(links)
    .join('line')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)

  // Create nodes
  const node = zoomGroup.append('g')
    .selectAll<SVGGElement, InfraNode>('g')
    .data(nodes)
    .join('g')
    .call(d3.drag<SVGGElement, InfraNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))

  // Add circles for nodes
  node.append('circle')
    .attr('r', 30)
    .attr('fill', (d: InfraNode) => {
      switch (d.type) {
        case 'loadbalancer': return '#60A5FA' // blue
        case 'server': return '#34D399' // green
        case 'worker': return '#FBBF24' // yellow
        default: return '#9CA3AF' // gray
      }
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)

  // Add labels
  node.append('text')
    .text((d: InfraNode) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', 40)
    .attr('fill', '#fff')
    .attr('font-size', '12px')

  // Add icons
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 5)
    .attr('fill', '#fff')
    .attr('font-size', '20px')
    .text((d: InfraNode) => {
      switch (d.type) {
        case 'loadbalancer': return '⚖️'
        case 'server': return '🖥️'
        case 'worker': return '⚙️'
        default: return '📦'
      }
    })

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
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Cloud Infrastructure
        </h3>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
          Design and manage your cloud infrastructure visually or using CDK
        </p>
      </div>

      <!-- View Toggle -->
      <div class="mb-8 flex items-center gap-4">
        <button
          v-for="view in ['visual', 'code']"
          :key="view"
          @click="activeView = view as 'visual' | 'code'"
          :class="{
            'px-4 py-2 text-sm font-medium rounded-md': true,
            'bg-blue-600 text-white': activeView === view,
            'bg-gray-100 text-gray-700 dark:bg-blue-gray-700 dark:text-gray-300': activeView !== view,
          }"
        >
          {{ view.charAt(0).toUpperCase() + view.slice(1) }} Builder
        </button>
      </div>

      <!-- Infrastructure Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Infrastructure Diagram</h4>
          <div ref="diagramContainer" class="w-full h-[400px] bg-blue-gray-800 rounded-lg"></div>
        </div>
      </div>

      <!-- Worker Configuration -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Worker Configuration</h4>

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
                <option v-for="size in ['Small', 'Medium', 'Large'] as const" :key="size" :value="size">
                  {{ size }} ({{ workerSizes[size].vcpu }} vCPU, {{ workerSizes[size].ram }}MB RAM)
                </option>
              </select>
            </div>
          </div>

          <!-- Replicas Slider -->
          <div class="mt-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Replicas ({{ workerConfig.replicas }})
            </label>
            <div class="relative mt-2">
              <input
                v-model.number="workerConfig.replicas"
                type="range"
                min="1"
                max="10"
                step="1"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              >
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
                <span>10</span>
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
                  {{ (workerConfig.specs.ram * workerConfig.replicas).toFixed(0) }}MB
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Visual Builder -->
      <div v-if="activeView === 'visual'" class="space-y-8">
        <!-- Global Settings -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Global Settings</h4>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cloud Provider</label>
              <select
                v-model="cloudConfig.type"
                class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="aws">AWS</option>
                <option value="gcp">Google Cloud</option>
                <option value="azure">Azure</option>
              </select>
            </div>
            <div class="flex items-center">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="cloudConfig.useLoadBalancer"
                  type="checkbox"
                  class="sr-only peer"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Use Load Balancer</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Servers -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Servers</h4>
              <button
                @click="addServer"
                type="button"
                class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              >
                Add Server
              </button>
            </div>

            <div class="space-y-6">
              <div
                v-for="(server, key) in cloudConfig.servers"
                :key="key"
                class="border dark:border-gray-600 rounded-lg p-4"
              >
                <div class="flex items-center justify-between mb-4">
                  <h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ server.name }}</h5>
                  <button
                    @click="removeServer(key)"
                    class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      v-model="server.name"
                      type="text"
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
                    <input
                      v-model="server.domain"
                      type="text"
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                    <select
                      v-model="server.region"
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
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
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
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
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                    >
                      <option v-for="type in instanceTypes" :key="type" :value="type">
                        {{ type }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operating System</label>
                    <select
                      v-model="server.serverOS"
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
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
                      class="block w-full h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                    >
                  </div>

                  <div class="sm:col-span-2 lg:col-span-3">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Data Script</label>
                    <textarea
                      v-model="server.userData"
                      rows="3"
                      class="block w-full text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 font-mono"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Code View -->
      <div v-else class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="mb-4">
            <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">CDK Code</h4>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Generated AWS CDK TypeScript code for your infrastructure
            </p>
          </div>
          <MonacoEditor
            v-model="cdkCode"
            language="typescript"
            theme="vs-dark"
            :options="{
              readOnly: true,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }"
            class="h-[600px] w-full rounded-md overflow-hidden"
          />
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
