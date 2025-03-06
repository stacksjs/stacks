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
  title: 'Dashboard - Authors',
})

// Define author type
interface Author {
  id: string
  name: string
  email: string
  bio: string
  avatar: string
  postCount: number
  role: 'admin' | 'editor' | 'contributor'
  createdAt: string
}

// Sample authors data
const authors = ref<Author[]>([
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    bio: 'Senior developer with 10+ years of experience in web technologies. Passionate about JavaScript and modern frameworks.',
    avatar: '/images/avatars/avatar-1.jpg',
    postCount: 24,
    role: 'admin',
    createdAt: '2023-01-15T09:30:00Z'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    bio: 'UX/UI designer specializing in user-centered design. Advocate for accessibility and inclusive design practices.',
    avatar: '/images/avatars/avatar-2.jpg',
    postCount: 18,
    role: 'editor',
    createdAt: '2023-02-20T14:20:00Z'
  },
  {
    id: '3',
    name: 'Robert Johnson',
    email: 'robert.j@example.com',
    bio: 'Full-stack developer with a focus on backend technologies. Experienced in building scalable applications.',
    avatar: '/images/avatars/avatar-3.jpg',
    postCount: 12,
    role: 'contributor',
    createdAt: '2023-03-10T11:15:00Z'
  },
  {
    id: '4',
    name: 'Emily Chen',
    email: 'emily.chen@example.com',
    bio: 'Content strategist and technical writer. Specializes in creating clear, concise documentation for developers.',
    avatar: '/images/avatars/avatar-4.jpg',
    postCount: 15,
    role: 'editor',
    createdAt: '2023-03-25T16:45:00Z'
  },
  {
    id: '5',
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    bio: 'DevOps engineer with expertise in CI/CD pipelines and cloud infrastructure. AWS certified professional.',
    avatar: '/images/avatars/avatar-5.jpg',
    postCount: 8,
    role: 'contributor',
    createdAt: '2023-04-05T08:30:00Z'
  },
  {
    id: '6',
    name: 'Sarah Wilson',
    email: 'sarah.w@example.com',
    bio: 'Frontend developer specializing in React and Vue.js. Passionate about creating responsive and accessible interfaces.',
    avatar: '/images/avatars/avatar-6.jpg',
    postCount: 10,
    role: 'contributor',
    createdAt: '2023-04-18T13:40:00Z'
  },
  {
    id: '7',
    name: 'David Lee',
    email: 'david.lee@example.com',
    bio: 'Security specialist with a background in penetration testing and vulnerability assessment. CISSP certified.',
    avatar: '/images/avatars/avatar-7.jpg',
    postCount: 6,
    role: 'editor',
    createdAt: '2023-05-02T10:10:00Z'
  },
  {
    id: '8',
    name: 'Lisa Taylor',
    email: 'lisa.t@example.com',
    bio: 'Data scientist with expertise in machine learning and AI. Passionate about using data to solve real-world problems.',
    avatar: '/images/avatars/avatar-8.jpg',
    postCount: 9,
    role: 'contributor',
    createdAt: '2023-05-15T09:45:00Z'
  },
  {
    id: '9',
    name: 'James Wilson',
    email: 'james.w@example.com',
    bio: 'Mobile app developer with experience in both iOS and Android platforms. Advocate for cross-platform development.',
    avatar: '/images/avatars/avatar-9.jpg',
    postCount: 7,
    role: 'contributor',
    createdAt: '2023-06-01T15:30:00Z'
  },
  {
    id: '10',
    name: 'Amanda Garcia',
    email: 'amanda.g@example.com',
    bio: 'Product manager with a background in software development. Focused on creating user-centric products.',
    avatar: '/images/avatars/avatar-10.jpg',
    postCount: 5,
    role: 'editor',
    createdAt: '2023-06-15T11:25:00Z'
  },
  {
    id: '11',
    name: 'Thomas Wright',
    email: 'thomas.w@example.com',
    bio: 'Backend developer specializing in API design and database optimization. Experienced with SQL and NoSQL databases.',
    avatar: '/images/avatars/avatar-11.jpg',
    postCount: 11,
    role: 'contributor',
    createdAt: '2023-07-01T13:40:00Z'
  },
  {
    id: '12',
    name: 'Olivia Martinez',
    email: 'olivia.m@example.com',
    bio: 'Technical lead with experience managing development teams. Passionate about mentoring junior developers.',
    avatar: '/images/avatars/avatar-12.jpg',
    postCount: 14,
    role: 'admin',
    createdAt: '2023-07-15T08:50:00Z'
  }
])

// Chart and diagram functionality
const timeRange = ref<'7' | '30' | '90' | '365'>('30')
const isLoading = ref(false)
const diagramContainer = ref<HTMLElement | null>(null)
const selectedModel = ref<ModelNode | null>(null)
const router = useRouter()

// Helper function to format dates
const formatDate = (daysAgo: number) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

// Format date string for display
const formatDateString = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '')
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
            if (value >= 1000000) return `${label}${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${label}${(value / 1000).toFixed(1)}k`
            return `${label}${value}`
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
  const days = Number(timeRange.value)
  const labels = generateDateLabels(days)
  const baseCount = authors.value.length // Starting with current authors count
  const dailyGrowth = Math.max(1, Math.floor(baseCount * 0.01)) // Average 1% growth per day

  return {
    labels,
    datasets: [{
      label: 'Total Authors',
      data: generateGrowthData(days, baseCount, dailyGrowth),
      borderColor: 'rgb(59, 130, 246)', // Blue color for authors
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }, {
      label: 'Total Posts',
      data: generateGrowthData(days, authors.value.reduce((sum, author) => sum + author.postCount, 0), dailyGrowth * 2), // Posts grow faster
      borderColor: 'rgb(34, 197, 94)', // Green color for posts
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

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

// Author model and its relationships
const models: ModelNode[] = [
  {
    id: 'author',
    name: 'Author',
    description: 'Core author model representing blog content creators with profile information.',
    properties: ['id', 'name', 'email', 'bio', 'avatar', 'role'],
    relationships: ['posts', 'categories', 'comments'],
    emoji: '✍️',
    color: '#2563EB'
  },
  {
    id: 'post',
    name: 'Post',
    description: 'Blog post content created by authors. Each post can belong to multiple categories.',
    properties: ['id', 'title', 'content', 'author_id', 'published_at'],
    relationships: ['author', 'categories', 'comments', 'tags'],
    emoji: '📝',
    color: '#60A5FA'
  },
  {
    id: 'category',
    name: 'Category',
    description: 'Organizational structure for grouping related blog posts.',
    properties: ['id', 'name', 'slug', 'description'],
    relationships: ['posts', 'authors', 'tags'],
    emoji: '🏷️',
    color: '#3B82F6'
  },
  {
    id: 'tag',
    name: 'Tag',
    description: 'Labels that can be applied to posts for more granular categorization.',
    properties: ['id', 'name', 'slug'],
    relationships: ['posts', 'categories'],
    emoji: '🔖',
    color: '#818CF8'
  },
  {
    id: 'comment',
    name: 'Comment',
    description: 'User-generated feedback on blog posts.',
    properties: ['id', 'content', 'post_id', 'user_id'],
    relationships: ['post', 'user'],
    emoji: '💬',
    color: '#93C5FD'
  },
  {
    id: 'user',
    name: 'User',
    description: 'Application users who can read and comment on blog posts.',
    properties: ['id', 'name', 'email', 'password'],
    relationships: ['comments'],
    emoji: '👤',
    color: '#BFDBFE'
  }
]

// Define relationships
const relationships: RelationshipLink[] = [
  { source: 'author', target: 'post', type: 'hasMany' },
  { source: 'post', target: 'author', type: 'belongsTo' },
  { source: 'post', target: 'category', type: 'belongsToMany' },
  { source: 'category', target: 'post', type: 'belongsToMany' },
  { source: 'post', target: 'comment', type: 'hasMany' },
  { source: 'comment', target: 'post', type: 'belongsTo' },
  { source: 'user', target: 'comment', type: 'hasMany' },
  { source: 'comment', target: 'user', type: 'belongsTo' },
  // New relationships
  { source: 'author', target: 'category', type: 'belongsToMany' },
  { source: 'category', target: 'author', type: 'belongsToMany' },
  { source: 'tag', target: 'post', type: 'belongsToMany' },
  { source: 'post', target: 'tag', type: 'belongsToMany' },
  { source: 'tag', target: 'category', type: 'belongsTo' },
  { source: 'category', target: 'tag', type: 'hasMany' }
]

// Visualization state
let simulation: d3.Simulation<ModelNode, undefined>

// Function to get route path for a model
const getModelRoute = (modelId: string) => {
  const routes: Record<string, string> = {
    author: '/blog/authors',
    authors: '/blog/authors',
    post: '/blog/posts',
    posts: '/blog/posts',
    category: '/blog/categories',
    categories: '/blog/categories',
    comment: '/blog/comments',
    comments: '/blog/comments',
    user: '/models/users',
    users: '/models/users'
  }
  return routes[modelId] || '/blog'
}

// Download functions
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
  link.download = 'author-model-relationships.svg'
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
      link.download = 'author-model-relationships.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')

    URL.revokeObjectURL(url)
  }

  img.src = url
}

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})

// D3 diagram initialization
onMounted(async () => {
  isLoading.value = true
  // Set Author as the default selected model
  selectedModel.value = models.find(model => model.id === 'author') || null
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

  // Define drag behavior
  const dragBehavior = d3.drag<SVGGElement, ModelNode>()
    .on('start', function(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', function(event, d) {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', function(event, d) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    })

  // Draw the nodes
  const node = svg.append('g')
    .selectAll<SVGGElement, ModelNode>('g')
    .data(models)
    .join('g')
    .style('cursor', 'pointer') // Add pointer cursor
    .on('click', (event, d) => {
      // Set the selected model
      selectedModel.value = d
      // Navigate to the model's page on double click
      if (event.detail === 2) {
        router.push(getModelRoute(d.id))
      }
    })

  // Apply drag behavior
  node.call(dragBehavior as any)

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
})

// Original author management functions
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const roleFilter = ref('all')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// New Author Modal
interface NewAuthorForm {
  name: string
  email: string
  bio: string
  role: 'admin' | 'editor' | 'contributor'
}

const newAuthor = ref<NewAuthorForm>({
  name: '',
  email: '',
  bio: '',
  role: 'contributor'
})
const showNewAuthorModal = ref(false)

// Edit Author Modal
const showEditModal = ref(false)
const authorToEdit = ref<Author | null>(null)

// Delete Confirmation Modal
const showDeleteConfirmation = ref(false)
const authorToDelete = ref<Author | null>(null)
const selectedAuthorIds = ref<string[]>([])
const selectAll = ref(false)

// Computed properties
const filteredAuthors = computed(() => {
  let result = [...authors.value]

  // Apply role filter
  if (roleFilter.value !== 'all') {
    result = result.filter(author => author.role === roleFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(author =>
      author.name.toLowerCase().includes(query) ||
      author.email.toLowerCase().includes(query) ||
      author.bio.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result.sort((a, b) => {
    const sortField = sortBy.value as keyof Author
    let aValue = a[sortField]
    let bValue = b[sortField]

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (sortOrder.value === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  return result
})

// Pagination
const totalPages = computed(() => Math.ceil(filteredAuthors.value.length / itemsPerPage.value))

const paginatedAuthors = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredAuthors.value.slice(startIndex, endIndex)
})

const paginationRange = computed(() => {
  const range: number[] = []
  const maxVisiblePages = 5
  const startPage = Math.max(1, currentPage.value - Math.floor(maxVisiblePages / 2))
  const endPage = Math.min(totalPages.value, startPage + maxVisiblePages - 1)

  for (let i = startPage; i <= endPage; i++) {
    range.push(i)
  }

  return range
})

// Methods
function openNewAuthorModal(): void {
  newAuthor.value = {
    name: '',
    email: '',
    bio: '',
    role: 'contributor'
  }
  showNewAuthorModal.value = true
}

function closeNewAuthorModal(): void {
  showNewAuthorModal.value = false
}

function createAuthor(): void {
  // Validate required fields
  if (!newAuthor.value.name || !newAuthor.value.email) return

  const newId = (Math.max(...authors.value.map(a => parseInt(a.id))) + 1).toString()
  const currentDate = new Date().toISOString()

  authors.value.push({
    id: newId,
    name: newAuthor.value.name,
    email: newAuthor.value.email,
    bio: newAuthor.value.bio || '', // Ensure bio is never undefined
    avatar: '/images/avatars/avatar-1.jpg', // Cycle through available avatars
    postCount: 0,
    role: newAuthor.value.role,
    createdAt: currentDate
  })

  closeNewAuthorModal()
}

function openEditModal(author: Author): void {
  authorToEdit.value = { ...author }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
}

function updateAuthor(): void {
  if (!authorToEdit.value) return

  const author = authorToEdit.value // Store in a variable to avoid null checks
  const index = authors.value.findIndex(a => a.id === author.id)
  if (index !== -1) {
    authors.value[index] = { ...author }
  }

  closeEditModal()
}

function confirmDeleteAuthor(author: Author): void {
  authorToDelete.value = author
  selectedAuthorIds.value = []
  showDeleteConfirmation.value = true
}

function confirmDeleteSelected(): void {
  showDeleteConfirmation.value = true
}

function closeDeleteModal(): void {
  showDeleteConfirmation.value = false
  authorToDelete.value = null
}

function deleteSelectedAuthors(): void {
  if (selectedAuthorIds.value.length > 1) {
    // Delete multiple authors
    authors.value = authors.value.filter(author => !selectedAuthorIds.value.includes(author.id))
    selectedAuthorIds.value = []
  } else if (authorToDelete.value) {
    // Delete single author
    const author = authorToDelete.value // Store in a variable to avoid null checks
    authors.value = authors.value.filter(a => a.id !== author.id)
  }

  closeDeleteModal()
}

function toggleSelectAll(): void {
  if (selectAll.value) {
    // Select all authors on current page
    selectedAuthorIds.value = paginatedAuthors.value.map(author => author.id)
  } else {
    // Deselect all
    selectedAuthorIds.value = []
  }
}

function toggleAuthorSelection(authorId: string): void {
  const index = selectedAuthorIds.value.indexOf(authorId)
  if (index === -1) {
    selectedAuthorIds.value.push(authorId)
  } else {
    selectedAuthorIds.value.splice(index, 1)
  }

  // Update selectAll based on whether all authors are selected
  selectAll.value = paginatedAuthors.value.every(author => selectedAuthorIds.value.includes(author.id))
}

const hasSelectedAuthors = computed(() => selectedAuthorIds.value.length > 0)

// Get role badge class
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/30'
    case 'editor':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30'
    case 'contributor':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/20 dark:text-gray-400 dark:ring-gray-500/30'
  }
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats section -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Total Authors
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ authors.length }}
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                {{ Math.floor(authors.length * 0.05) }}
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-green-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Total Posts
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ authors.reduce((sum, author) => sum + author.postCount, 0) }}
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                {{ Math.floor(authors.reduce((sum, author) => sum + author.postCount, 0) * 0.08) }}
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-purple-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Admin Authors
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ authors.filter(author => author.role === 'admin').length }}
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                {{ Math.floor(authors.filter(author => author.role === 'admin').length * 0.03) }}
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
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Author Growth & Activity</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Track author registrations and post activity over time</p>
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
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Author Model Relationships</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Interactive diagram showing Author model relationships. Click on any model to view details.</p>
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
                v-if="selectedModel.id !== 'author'"
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

    <div class="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <!-- Page header -->
      <div class="sm:flex sm:justify-between sm:items-center mb-8">
        <!-- Left: Title -->
        <div class="mb-4 sm:mb-0">
          <h1 class="text-2xl md:text-3xl text-slate-800 dark:text-slate-100 font-bold">Blog Authors</h1>
        </div>

        <!-- Right: Actions -->
        <div class="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
          <!-- Add author button -->
          <button
            @click="openNewAuthorModal"
            class="btn bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <svg class="w-4 h-4 fill-current opacity-50 shrink-0" viewBox="0 0 16 16">
              <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1h6v6c0 .6.4 1 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
            </svg>
            <span class="hidden xs:block ml-2">Add Author</span>
          </button>
        </div>
      </div>

      <!-- Filters and search -->
      <div class="px-4 lg:px-8 sm:px-6">
        <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg">
          <div class="border-b border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
            <div class="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
              <div class="ml-4 mt-2">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Authors</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  A list of all authors in your blog system including their name, email, role, and post count.
                </p>
              </div>
              <div class="ml-4 mt-2 flex-shrink-0">
                <button
                  @click="openNewAuthorModal"
                  type="button"
                  class="relative inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Add author
                </button>
              </div>
            </div>
          </div>

          <div class="px-4 py-5 sm:p-6">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <!-- Search -->
              <div>
                <label for="search" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">Search</label>
                <div class="relative mt-2 rounded-md shadow-sm">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    v-model="searchQuery"
                    id="search"
                    class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-blue-gray-600"
                    placeholder="Search authors..."
                  />
                </div>
              </div>

              <!-- Role filter -->
              <div>
                <label for="role-filter" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">Role</label>
                <select
                  id="role-filter"
                  v-model="roleFilter"
                  class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-blue-gray-600"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="contributor">Contributor</option>
                </select>
              </div>

              <!-- Sort by -->
              <div>
                <label for="sort-by" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">Sort by</label>
                <select
                  id="sort-by"
                  v-model="sortBy"
                  class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-blue-gray-600"
                >
                  <option value="name">Name</option>
                  <option value="postCount">Post Count</option>
                  <option value="role">Role</option>
                  <option value="createdAt">Date Added</option>
                </select>
              </div>

              <!-- Sort order -->
              <div>
                <label for="sort-order" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">Order</label>
                <select
                  id="sort-order"
                  v-model="sortOrder"
                  class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-blue-gray-600"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Authors Table -->
      <div class="px-4 pt-12 lg:px-8 sm:px-6">
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-base text-gray-900 font-semibold leading-6">
              Authors
            </h1>
            <p class="mt-2 text-sm text-gray-700">
              A list of all your blog authors.
            </p>
          </div>

          <!-- Removing the Add Author button -->
        </div>

        <div class="mt-8 flow-root">
          <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
            <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg w-full">
                <table class="min-w-full divide-y divide-gray-300 w-full">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                        ID
                      </th>

                      <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                        Name
                      </th>

                      <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                        Role
                      </th>

                      <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                        Posts
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
                    <tr v-for="author in paginatedAuthors" :key="author.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                        {{ author.id }}
                      </td>

                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div class="flex items-center">
                          <div class="h-10 w-10 flex-shrink-0">
                            <img
                              :src="author.avatar || 'https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg'"
                              alt=""
                              class="h-10 w-10 rounded-full"
                            >
                          </div>

                          <div class="ml-4">
                            <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                              {{ author.name }}
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-300 dark:text-gray-400">
                              {{ author.email }}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span :class="['role-badge', author.role]">{{ author.role }}</span>
                      </td>

                      <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                        {{ author.postCount }}
                      </td>

                      <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                        {{ formatDateString(author.createdAt) }}
                      </td>

                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <a @click="openEditModal(author)" href="#" class="text-blue-600 hover:text-blue-900">Edit<span class="sr-only">, {{ author.name }}</span></a>
                      </td>
                    </tr>
                    <!-- Empty state -->
                    <tr v-if="paginatedAuthors.length === 0">
                      <td colspan="6" class="py-10 text-center">
                        <div class="flex flex-col items-center justify-center">
                          <svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No authors found</h3>
                          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">No authors match your current filters.</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-5 sm:px-6 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="currentPage > 1 ? currentPage-- : null"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-700 hover:bg-gray-50 dark:hover:bg-blue-gray-600 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              @click="currentPage < totalPages ? currentPage++ : null"
              :disabled="currentPage === totalPages"
              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-blue-gray-700 hover:bg-gray-50 dark:hover:bg-blue-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing
                <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span>
                to
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredAuthors.length) }}</span>
                of
                <span class="font-medium">{{ filteredAuthors.length }}</span>
                results
              </p>
            </div>
            <div>
              <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  @click="currentPage > 1 ? currentPage-- : null"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-600 disabled:opacity-50"
                >
                  <span class="sr-only">Previous</span>
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l4.5-4.25a.75.75 0 010-1.08l4.5 4.25a.75.75 0 01-1.06.02z" clip-rule="evenodd" />
                  </svg>
                </button>
                <template v-for="page in totalPages" :key="page">
                  <button
                    v-if="page === currentPage"
                    class="relative inline-flex items-center px-4 py-2 border border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-sm font-medium text-indigo-600 dark:text-indigo-300"
                  >
                    {{ page }}
                  </button>
                  <button
                    v-else
                    @click="currentPage = page"
                    class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-blue-gray-600"
                  >
                    {{ page }}
                  </button>
                </template>
                <button
                  @click="currentPage < totalPages ? currentPage++ : null"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-blue-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-blue-gray-600 disabled:opacity-50"
                >
                  <span class="sr-only">Next</span>
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk actions -->
      <div v-if="hasSelectedAuthors" class="mt-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg shadow-sm">
        <div class="flex items-center space-x-3">
          <div class="flex items-center">
            <svg class="w-4 h-4 fill-current text-blue-500 dark:text-blue-400 shrink-0 mr-2" viewBox="0 0 16 16">
              <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1zm1-3H7V4h2v5z" />
            </svg>
            <span class="text-sm font-medium text-blue-800 dark:text-blue-300">
              {{ selectedAuthorIds.length }} author{{ selectedAuthorIds.length !== 1 ? 's' : '' }} selected
            </span>
          </div>
          <div class="border-l border-blue-200 dark:border-blue-700 h-6 mx-2"></div>
          <button
            @click="confirmDeleteSelected"
            class="btn-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-rose-500 hover:text-rose-600"
          >
            <svg class="w-4 h-4 fill-current shrink-0 mr-1" viewBox="0 0 16 16">
              <path d="M5 7h2v6H5V7zm4 0h2v6H9V7zm3-6v2h4v2h-1v10c0 .6-.4 1-1 1H2c-.6 0-1-.4-1-1-1-1V5H0V3h4V1c0-.6.4-1 1-1h6c.6 0 1 .4 1 1zM6 2v1h4V2H6zm7 3H3v9h10V5z" />
            </svg>
            <span>Delete Selected</span>
          </button>
        </div>
      </div>

      <!-- New Author Modal -->
      <div
        v-if="showNewAuthorModal"
        class="fixed inset-0 bg-slate-900 bg-opacity-30 z-50 transition-opacity"
        aria-hidden="true"
      >
        <!-- Modal dialog -->
        <div
          class="fixed inset-0 z-50 overflow-hidden flex items-center my-4 justify-center px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
          <div
            class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
          >
            <div>
              <div class="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-headline">
                  Add New Author
                </h3>
                <div class="mt-4">
                  <div class="mb-4">
                    <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="name"
                      v-model="newAuthor.name"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter name"
                    />
                  </div>
                  <div class="mb-4">
                    <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      id="email"
                      v-model="newAuthor.email"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter email"
                    />
                  </div>
                  <div class="mb-4">
                    <label for="bio" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                    <textarea
                      id="bio"
                      v-model="newAuthor.bio"
                      rows="3"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter bio"
                    ></textarea>
                  </div>
                  <div class="mb-4">
                    <label for="role" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                    <select
                      id="role"
                      v-model="newAuthor.role"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="contributor">Contributor</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                @click="closeNewAuthorModal"
                class="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="createAuthor"
                :disabled="!newAuthor.name || !newAuthor.email || !newAuthor.role"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Author
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Author Modal -->
      <div
        v-if="showEditModal"
        class="fixed inset-0 bg-slate-900 bg-opacity-30 z-50 transition-opacity"
        aria-hidden="true"
      >
        <!-- Modal dialog -->
        <div
          class="fixed inset-0 z-50 overflow-hidden flex items-center my-4 justify-center px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
          <div
            class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
          >
            <div>
              <div class="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-headline">
                  Edit Author
                </h3>
                <div v-if="authorToEdit" class="mt-4">
                  <div class="mb-4">
                    <label for="edit-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="edit-name"
                      v-model="authorToEdit.name"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter name"
                    />
                  </div>
                  <div class="mb-4">
                    <label for="edit-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      id="edit-email"
                      v-model="authorToEdit.email"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter email"
                    />
                  </div>
                  <div class="mb-4">
                    <label for="edit-bio" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                    <textarea
                      id="edit-bio"
                      v-model="authorToEdit.bio"
                      rows="3"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="Enter bio"
                    ></textarea>
                  </div>
                  <div class="mb-4">
                    <label for="edit-role" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                    <select
                      id="edit-role"
                      v-model="authorToEdit.role"
                      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="contributor">Contributor</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                @click="closeEditModal"
                class="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="updateAuthor"
                :disabled="!authorToEdit || !authorToEdit.name || !authorToEdit.email || !authorToEdit.role"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div
        v-if="showDeleteConfirmation"
        class="fixed inset-0 bg-slate-900 bg-opacity-30 z-50 transition-opacity"
        aria-hidden="true"
      >
        <!-- Modal dialog -->
        <div
          class="fixed inset-0 z-50 overflow-hidden flex items-center my-4 justify-center px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
          <div
            class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
          >
            <div>
              <div class="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-headline">
                  Delete Author
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to delete {{ selectedAuthorIds.length > 1 ? 'these authors' : 'this author' }}? This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                @click="showDeleteConfirmation = false"
                class="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="deleteSelectedAuthors"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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

/* Chart styles */
.chart-container {
  position: relative;
  height: 400px;
}

/* Table styles */
.authors-table th {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.authors-table tbody tr {
  transition: background-color 0.2s;
}

.authors-table tbody tr:hover {
  background-color: rgba(243, 244, 246, 0.5);
}

.dark .authors-table tbody tr:hover {
  background-color: rgba(55, 65, 81, 0.3);
}

/* Badge styles */
.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.role-badge.admin {
  background-color: rgba(79, 70, 229, 0.1);
  color: rgb(79, 70, 229);
}

.role-badge.editor {
  background-color: rgba(16, 185, 129, 0.1);
  color: rgb(16, 185, 129);
}

.role-badge.contributor {
  background-color: rgba(245, 158, 11, 0.1);
  color: rgb(245, 158, 11);
}

.dark .role-badge.admin {
  background-color: rgba(99, 102, 241, 0.2);
  color: rgb(165, 180, 252);
}

.dark .role-badge.editor {
  background-color: rgba(16, 185, 129, 0.2);
  color: rgb(110, 231, 183);
}

.dark .role-badge.contributor {
  background-color: rgba(245, 158, 11, 0.2);
  color: rgb(252, 211, 77);
}
</style>
