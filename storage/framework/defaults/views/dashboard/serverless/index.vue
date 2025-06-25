<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Serverless',
})

// Service types and their relationships based on the cloud directory structure
interface ServiceNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: 'compute' | 'storage' | 'database' | 'queue' | 'cache' | 'search' | 'api' | 'cdn' | 'auth' | 'notification' | 'dns' | 'email' | 'network' | 'security'
  description: string
  icon: string
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface ServiceLink {
  source: string | ServiceNode
  target: string | ServiceNode
  type: 'uses' | 'triggers' | 'connects' | 'processes' | 'protects'
}

// Define AWS services based on the cloud directory
const services: ServiceNode[] = [
  {
    id: 'lambda',
    name: 'Lambda',
    type: 'compute',
    description: 'Serverless compute service',
    icon: '⚡️',
    color: '#F90F71'
  },
  {
    id: 's3',
    name: 'S3',
    type: 'storage',
    description: 'Object storage service',
    icon: '📦',
    color: '#6CAE3E'
  },
  {
    id: 'dynamodb',
    name: 'DynamoDB',
    type: 'database',
    description: 'NoSQL database service',
    icon: '🗄️',
    color: '#527FFF'
  },
  {
    id: 'sqs',
    name: 'SQS',
    type: 'queue',
    description: 'Message queue service',
    icon: '📨',
    color: '#FF4F8B'
  },
  {
    id: 'apigateway',
    name: 'API Gateway',
    type: 'api',
    description: 'API management service',
    icon: '🚪',
    color: '#A166FF'
  },
  {
    id: 'cloudfront',
    name: 'CloudFront',
    type: 'cdn',
    description: 'Content delivery network',
    icon: '🌐',
    color: '#A166FF'
  },
  {
    id: 'route53',
    name: 'Route 53',
    type: 'dns',
    description: 'DNS and domain management service',
    icon: '🌍',
    color: '#C77DFF'
  },
  {
    id: 'ses',
    name: 'SES',
    type: 'email',
    description: 'Email sending and receiving service',
    icon: '📧',
    color: '#FF8E8E'
  },
  {
    id: 'vpc',
    name: 'VPC',
    type: 'network',
    description: 'Virtual Private Cloud networking',
    icon: '🔒',
    color: '#64B5FF'
  },
  {
    id: 'efs',
    name: 'EFS',
    type: 'storage',
    description: 'Elastic File System',
    icon: '💾',
    color: '#00D1B2'
  },
  {
    id: 'ecs',
    name: 'ECS',
    type: 'compute',
    description: 'Elastic Container Service',
    icon: '🐳',
    color: '#FFC300'
  },
  {
    id: 'acm',
    name: 'ACM',
    type: 'security',
    description: 'Certificate Manager',
    icon: '🔐',
    color: '#A166FF'
  },
  {
    id: 'waf',
    name: 'WAF',
    type: 'security',
    description: 'Web Application Firewall',
    icon: '🛡️',
    color: '#FF6B6B'
  },
  {
    id: 'kms',
    name: 'KMS',
    type: 'security',
    description: 'Key Management Service',
    icon: '🔑',
    color: '#7F6B99'
  },
  {
    id: 'iam',
    name: 'IAM',
    type: 'security',
    description: 'Identity and Access Management - Controls access to all AWS resources',
    icon: '👤',
    color: '#DD344C'
  }
]

// Define relationships between services
const links: ServiceLink[] = [
  // API Gateway triggers Lambda
  {
    source: 'apigateway',
    target: 'lambda',
    type: 'triggers'
  },
  // Lambda uses various services
  {
    source: 'lambda',
    target: 's3',
    type: 'uses'
  },
  {
    source: 'lambda',
    target: 'dynamodb',
    type: 'uses'
  },
  {
    source: 'lambda',
    target: 'sqs',
    type: 'processes'
  },
  // CloudFront connects to S3 directly
  {
    source: 'cloudfront',
    target: 's3',
    type: 'connects'
  },
  // Route53 routes to various endpoints
  {
    source: 'route53',
    target: 'cloudfront',
    type: 'connects'
  },
  {
    source: 'route53',
    target: 'apigateway',
    type: 'connects'
  },
  {
    source: 'route53',
    target: 'ecs',
    type: 'connects'
  },
  // Lambda uses various services
  {
    source: 'lambda',
    target: 'ses',
    type: 'uses'
  },
  {
    source: 'lambda',
    target: 'vpc',
    type: 'uses'
  },
  // ECS uses VPC and storage
  {
    source: 'ecs',
    target: 'vpc',
    type: 'uses'
  },
  {
    source: 'ecs',
    target: 'efs',
    type: 'uses'
  },
  // Security service connections
  {
    source: 'waf',
    target: 'cloudfront',
    type: 'protects'
  },
  {
    source: 'waf',
    target: 'apigateway',
    type: 'protects'
  },
  {
    source: 'kms',
    target: 's3',
    type: 'protects'
  },
  {
    source: 'kms',
    target: 'efs',
    type: 'protects'
  },
  {
    source: 'acm',
    target: 'cloudfront',
    type: 'protects'
  },
  {
    source: 'acm',
    target: 'apigateway',
    type: 'protects'
  },
  {
    source: 'acm',
    target: 'ecs',
    type: 'protects'
  }
]

// Visualization state
const diagramContainer = ref<HTMLElement | null>(null)
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
let simulation: d3.Simulation<ServiceNode, undefined>
let zoomGroup: d3.Selection<SVGGElement, unknown, null, undefined>
const selectedNode = ref<ServiceNode | null>(null)

// Add zoom variable to the outer scope
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>

// Function to create and update the visualization
const updateVisualization = () => {
  if (!diagramContainer.value) return

  const width = diagramContainer.value.clientWidth
  const height = 600

  // Clear existing visualization
  d3.select(diagramContainer.value).selectAll('*').remove()

  // Create SVG
  svg = d3.select(diagramContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;')

  // Add zoom behavior
  zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      zoomGroup.attr('transform', event.transform.toString())
    })

  svg.call(zoom)

  // Add zoom group
  zoomGroup = svg.append('g')

  // Create nodes with proper icon handling
  const node = zoomGroup.append('g')
    .selectAll<SVGGElement, ServiceNode>('g')
    .data(services)
    .join('g')
    .attr('class', 'node')
    .attr('data-type', d => d.type)
    .call((g) => g.call(d3.drag<SVGGElement, ServiceNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)))
    .on('click', (event: MouseEvent, d: ServiceNode) => {
      event.stopPropagation()
      selectedNode.value = d
      node.classed('selected', n => n === d)
    })

  // Add circles for nodes
  node.append('circle')
    .attr('r', 30)
    .attr('fill', '#1E293B')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 3)

  // Add colored background circles for icons
  node.append('circle')
    .attr('r', 20)
    .attr('fill', d => d.color)
    .style('opacity', '0.9')

  // Add emoji icons
  node.append('text')
    .attr('class', 'service-icon')
    .attr('dy', '0.35em')
    .attr('fill', '#ffffff')
    .attr('font-size', '22px')
    .style('text-anchor', 'middle')
    .style('dominant-baseline', 'middle')
    .style('filter', 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))')
    .text(d => d.icon)

  // Add labels
  node.append('text')
    .attr('class', 'service-label')
    .attr('dy', 50)
    .attr('fill', '#D1D5DB')
    .attr('font-size', '12px')
    .attr('font-weight', '500')
    .text(d => d.name)

  // Create links with proper styling
  const link = zoomGroup.append('g')
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'link')
    .attr('data-type', d => d.type)
    .attr('marker-end', d => `url(#${d.type})`)
    .style('fill', 'none')
    .style('stroke', d => {
      switch (d.type) {
        case 'triggers': return '#FF4F8B'
        case 'uses': return '#4053D6'
        case 'connects': return '#569A31'
        case 'processes': return '#FFC300'
        case 'protects': return '#A166FF'
        default: return '#569A31'
      }
    })

  // Create arrow markers
  svg.append('defs').selectAll('marker')
    .data(['uses', 'triggers', 'connects', 'processes', 'protects'])
    .join('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 45)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('fill', d => {
      switch (d) {
        case 'triggers': return '#FF4F8B'
        case 'uses': return '#4053D6'
        case 'connects': return '#569A31'
        case 'processes': return '#FFC300'
        case 'protects': return '#A166FF'
        default: return '#569A31'
      }
    })
    .attr('d', 'M0,-5L10,0L0,5')

  // Update simulation forces
  simulation = d3.forceSimulation(services)
    .force('link', d3.forceLink<ServiceNode, ServiceLink>(links)
      .id(d => d.id)
      .distance(d => {
        switch (d.type) {
          case 'triggers': return 180
          case 'uses': return 200
          case 'connects': return 220
          case 'processes': return 180
          default: return 200
        }
      }))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        const node = d as ServiceNode
        switch (node.type) {
          case 'security': return -1200
          case 'compute': return -1400
          case 'storage': return -1000
          default: return -1200
        }
      }))
    .force('collide', d3.forceCollide().radius(60))
    .force('x', d3.forceX().strength(0.1).x(width / 2))
    .force('y', d3.forceY().strength(0.1).y(height / 2))
    .alphaDecay(0.02)
    .velocityDecay(0.4)

  // Update positions on simulation tick
  simulation.on('tick', () => {
    // Update link paths
    link.attr('d', d => {
      const source = d.source as ServiceNode
      const target = d.target as ServiceNode
      const dx = target.x! - source.x!
      const dy = target.y! - source.y!
      const dr = Math.sqrt(dx * dx + dy * dy)

      // Calculate the points where the path should start and end
      // to connect with the circles
      const sourceRadius = 30  // Outer circle radius
      const targetRadius = 30  // Outer circle radius

      // Calculate the ratio of how far along the line we need to go
      const sourceRatio = sourceRadius / dr
      const targetRatio = targetRadius / dr

      // Calculate the actual points
      const startX = source.x! + dx * sourceRatio
      const startY = source.y! + dy * sourceRatio
      const endX = target.x! - dx * targetRatio
      const endY = target.y! - dy * targetRatio

      return `M${startX},${startY}L${endX},${endY}`
    })

    node.attr('transform', d => `translate(${d.x},${d.y})`)
  })

  // Add hover effects
  node
    .on('mouseover', function(event, d) {
      // Highlight connected links and nodes
      link
        .style('opacity', l =>
          (l.source === d || l.target === d) ? 1 : 0.1
        )
        .style('stroke-width', l =>
          (l.source === d || l.target === d) ? 3 : 2
        )
      node
        .style('opacity', n =>
          n === d || links.some(l =>
            (l.source === d && l.target === n) ||
            (l.target === d && l.source === n)
          ) ? 1 : 0.3
        )
    })
    .on('mouseout', function() {
      // Reset highlights
      link
        .style('opacity', 0.7)
        .style('stroke-width', 2)
      node
        .style('opacity', 1)
    })

  // Add click handler to clear selection
  svg.on('click', () => {
    selectedNode.value = null
    node.classed('selected', false)
  })

  // Update the header text
  const headerText = document.querySelector('.text-base.text-gray-900.dark\\:text-gray-100')
  if (headerText) {
    headerText.innerHTML = 'Serverless Infrastructure'
  }

  // Add IAM note
  const description = document.querySelector('.mt-2.text-sm.text-gray-700.dark\\:text-gray-400')
  if (description) {
    description.innerHTML = 'Visualize and manage your serverless AWS services and their relationships.'
  }
}

// Drag functions
function dragstarted(event: d3.D3DragEvent<SVGGElement, ServiceNode, unknown>, d: ServiceNode) {
  if (!event.active) simulation.alphaTarget(0.3).restart()
  d.fx = event.x
  d.fy = event.y
}

function dragged(event: d3.D3DragEvent<SVGGElement, ServiceNode, unknown>, d: ServiceNode) {
  d.fx = event.x
  d.fy = event.y
}

function dragended(event: d3.D3DragEvent<SVGGElement, ServiceNode, unknown>, d: ServiceNode) {
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

// Initialize visualization
onMounted(() => {
  if (diagramContainer.value) {
    // Add rounded corners to all service icon rectangles
    const svgRects = document.querySelectorAll('.node svg rect');
    svgRects.forEach(rect => {
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
    });

    updateVisualization();
  }
});

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
  link.download = 'serverless-services.svg'
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
      link.download = 'serverless-services.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pngUrl)
    })
  }

  img.src = url
}

const zoomIn = () => {
  if (!svg) return
  const transform = d3.zoomTransform(svg.node()!)
  svg.transition()
    .duration(300)
    .call(zoom.transform, transform.scale(transform.k * 1.3))
}

const zoomOut = () => {
  if (!svg) return
  const transform = d3.zoomTransform(svg.node()!)
  svg.transition()
    .duration(300)
    .call(zoom.transform, transform.scale(transform.k / 1.3))
}

const resetZoom = () => {
  if (!svg) return
  svg.transition()
    .duration(300)
    .call(zoom.transform, d3.zoomIdentity)
}

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
    service: 'Lambda',
    type: 'success',
    message: 'Function execution completed successfully',
    timestamp: '2024-03-21 14:23:45'
  },
  {
    id: '2',
    service: 'API Gateway',
    type: 'info',
    message: 'New API endpoint deployed',
    timestamp: '2024-03-21 14:20:12'
  },
  {
    id: '3',
    service: 'DynamoDB',
    type: 'warning',
    message: 'High read capacity utilization',
    timestamp: '2024-03-21 14:15:30'
  },
  {
    id: '4',
    service: 'CloudFront',
    type: 'error',
    message: 'Cache invalidation failed',
    timestamp: '2024-03-21 14:10:55'
  },
  {
    id: '5',
    service: 'S3',
    type: 'success',
    message: 'Bucket policy updated successfully',
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
          <div>
            <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
              Serverless Infrastructure
            </h3>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Visualize and manage your serverless AWS services and their relationships.
            </p>
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
      </div>

      <!-- Services Diagram -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Cloud Diagram</h4>
              <div class="flex items-center justify-center w-8 h-8 text-[#FF9900]">
                <div class="i-hugeicons-amazon w-6 h-6" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="zoomIn"
                class="inline-flex items-center justify-center w-8 h-8 text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                <span class="sr-only">Zoom In</span>
                <div class="i-hugeicons-plus-sign w-5 h-5" />
              </button>
              <button
                @click="zoomOut"
                class="inline-flex items-center justify-center w-8 h-8 text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                <span class="sr-only">Zoom Out</span>
                <div class="i-hugeicons-minus w-5 h-5" />
              </button>
              <button
                @click="resetZoom"
                class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
              >
                Reset
              </button>
            </div>
          </div>

          <div class="relative">
            <div ref="diagramContainer" class="w-full h-[600px] bg-blue-gray-800 rounded-lg" />

            <!-- Service Details Panel -->
            <div
              v-if="selectedNode"
              class="absolute top-4 right-4 w-80 bg-white dark:bg-blue-gray-700 rounded-lg shadow-lg p-4"
              @click.stop
            >
              <div class="flex items-center justify-between mb-4">
                <h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ selectedNode.name }}
                </h5>
                <button
                  @click="selectedNode = null"
                  class="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                >
                  <span class="sr-only">Close</span>
                  <div class="h-5 w-5">×</div>
                </button>
              </div>

              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center"
                    :style="{ backgroundColor: selectedNode.color + '20', color: selectedNode.color }"
                  >
                    <div :class="[selectedNode.icon, 'w-5 h-5']" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Type</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) }}
                    </p>
                  </div>
                </div>

                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ selectedNode.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Server Events Table -->
      <div>
        <div class="flex justify-between items-center mb-8 mt-16">
          <div>
            <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
              Recent Events
            </h3>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Latest server events and notifications from your AWS services.
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

<style scoped>
.dark svg {
  filter: brightness(0.8);
}

text {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.node {
  cursor: pointer;
}

.node circle {
  transition: all 0.2s ease;
}

.service-icon {
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  font-size: 20px !important;
  transform: translateY(1px); /* Fine-tune vertical alignment */
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
}

.service-label {
  text-anchor: middle;
  pointer-events: none;
  fill: #E5E7EB;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transform: translateY(45px);
}

.link {
  stroke-width: 2;
  stroke-opacity: 0.7;
  pointer-events: none;
  filter: saturate(1.2);
}

/* Link type styles with enhanced colors */
.link[data-type="triggers"] {
  stroke: #FF3B99;
  stroke-dasharray: none;
  stroke-width: 2.5;
}

.link[data-type="uses"] {
  stroke: #4B66FF;
  stroke-dasharray: none;
  stroke-width: 2;
}

.link[data-type="connects"] {
  stroke: #64B82E;
  stroke-width: 2;
  stroke-dasharray: 6,3;
}

.link[data-type="processes"] {
  stroke: #FFD700;
  stroke-width: 2;
  stroke-dasharray: 3,3;
}

.link[data-type="protects"] {
  stroke: #B347FF;
  stroke-width: 2;
  stroke-dasharray: 2,6;
}

/* Dark mode adjustments */
:deep(.dark) {
  .link {
    opacity: 0.8;
  }
}

/* Hover effects */
.node:hover {
  .service-icon {
    filter: brightness(1.2);
  }
  .service-label {
    filter: brightness(1.2);
  }
  circle {
    filter: brightness(1.2);
  }
}

.selected {
  .service-icon {
    filter: brightness(1.2);
  }
  .service-label {
    filter: brightness(1.2);
  }
  circle {
    filter: brightness(1.2);
  }
}

/* Add these new styles */
.node circle:first-of-type {
  fill-opacity: 0.95;
}

.node circle:nth-of-type(2) {
  fill-opacity: 0.9;
  filter: saturate(1.2) brightness(1.1);
}
</style>
