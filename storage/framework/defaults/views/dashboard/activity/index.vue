<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
} from 'chart.js'

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
  title: 'Dashboard - Activity Log',
})

// Laravel-style activity log interfaces
interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface ActivityLog {
  id: string
  log_name: string
  description: string
  subject_type: string
  subject_id: string
  causer_type: string | null
  causer_id: string | null
  properties: Record<string, any>
  created_at: string
  updated_at: string
  event: string
  batch_uuid?: string

  // Computed properties for display
  causer?: User
  subject_name?: string
  icon?: string
  color?: string
}

// Add pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)

const activityLogs = ref<ActivityLog[]>([])
const logNameFilter = ref('all')
const searchTerm = ref('')
const autoRefresh = ref(true)
const selectedLog = ref<ActivityLog | null>(null)
const isLoading = ref(false)
const eventFilter = ref<string>('all')
const subjectTypeFilter = ref<string>('all')

// Sample users for the activity logs
const users: User[] = [
  { id: '1', name: 'Chris Breuer', email: 'chris@stacksjs.org', avatar: 'https://i.pravatar.cc/150?u=chris' },
  { id: '2', name: 'John Doe', email: 'john@example.com', avatar: 'https://i.pravatar.cc/150?u=john' },
  { id: '3', name: 'Jane Smith', email: 'jane@example.com', avatar: 'https://i.pravatar.cc/150?u=jane' },
  { id: '4', name: 'System', email: 'system@stacksjs.org' },
]

// Sample log names (similar to Laravel channels)
const logNames = [
  { id: 'default', name: 'Default', color: 'blue' },
  { id: 'auth', name: 'Authentication', color: 'indigo' },
  { id: 'users', name: 'Users', color: 'purple' },
  { id: 'posts', name: 'Posts', color: 'pink' },
  { id: 'comments', name: 'Comments', color: 'rose' },
  { id: 'media', name: 'Media', color: 'amber' },
  { id: 'deployment', name: 'Deployment', color: 'emerald' },
  { id: 'server', name: 'Server', color: 'cyan' },
  { id: 'commerce', name: 'Commerce', color: 'orange' },
  { id: 'blog', name: 'Blog', color: 'violet' },
]

// Sample subject types
const subjectTypes = [
  { type: 'App\\Models\\User', name: 'User' },
  { type: 'App\\Models\\Post', name: 'Post' },
  { type: 'App\\Models\\Comment', name: 'Comment' },
  { type: 'App\\Models\\Media', name: 'Media' },
  { type: 'App\\Models\\Role', name: 'Role' },
  { type: 'App\\Models\\Permission', name: 'Permission' },
  { type: 'App\\Models\\Order', name: 'Order' },
  { type: 'App\\Services\\Deployment', name: 'Deployment' },
  { type: 'App\\Services\\Server', name: 'Server' },
  { type: 'App\\Services\\Api', name: 'API' },
  { type: 'App\\Services\\Backup', name: 'Backup' },
]

// Sample activity logs in Laravel Spatie Activity Log format
const sampleActivityLogs: ActivityLog[] = [
  {
    id: '1',
    log_name: 'default',
    description: 'created',
    subject_type: 'App\\Models\\User',
    subject_id: '5',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      attributes: {
        name: 'New User',
        email: 'newuser@example.com',
        created_at: new Date().toISOString(),
      },
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    event: 'created',
  },
  {
    id: '2',
    log_name: 'users',
    description: 'updated',
    subject_type: 'App\\Models\\User',
    subject_id: '2',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      old: {
        name: 'John Doe',
        email: 'john.old@example.com',
      },
      attributes: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    created_at: new Date(Date.now() - 5000).toISOString(),
    updated_at: new Date(Date.now() - 5000).toISOString(),
    event: 'updated',
  },
  {
    id: '3',
    log_name: 'auth',
    description: 'logged in',
    subject_type: 'App\\Models\\User',
    subject_id: '3',
    causer_type: 'App\\Models\\User',
    causer_id: '3',
    properties: {
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    created_at: new Date(Date.now() - 15000).toISOString(),
    updated_at: new Date(Date.now() - 15000).toISOString(),
    event: 'login',
  },
  {
    id: '4',
    log_name: 'posts',
    description: 'created',
    subject_type: 'App\\Models\\Post',
    subject_id: '42',
    causer_type: 'App\\Models\\User',
    causer_id: '2',
    properties: {
      attributes: {
        title: 'Getting Started with Stacks.js',
        slug: 'getting-started-with-stacks-js',
        content: 'This is a comprehensive guide to Stacks.js...',
        published: true,
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
      ip_address: '192.168.1.50',
    },
    created_at: new Date(Date.now() - 60000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
    event: 'created',
  },
  {
    id: '5',
    log_name: 'posts',
    description: 'updated',
    subject_type: 'App\\Models\\Post',
    subject_id: '42',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      old: {
        title: 'Getting Started with Stacks.js',
        content: 'This is a comprehensive guide to Stacks.js...',
      },
      attributes: {
        title: 'The Ultimate Guide to Stacks.js',
        content: 'This is a comprehensive guide to Stacks.js with updated information...',
      },
      ip_address: '192.168.1.1',
    },
    created_at: new Date(Date.now() - 120000).toISOString(),
    updated_at: new Date(Date.now() - 120000).toISOString(),
    event: 'updated',
  },
  {
    id: '6',
    log_name: 'comments',
    description: 'created',
    subject_type: 'App\\Models\\Comment',
    subject_id: '101',
    causer_type: 'App\\Models\\User',
    causer_id: '3',
    properties: {
      attributes: {
        post_id: 42,
        content: 'Great article! Very helpful for beginners.',
        created_at: new Date(Date.now() - 180000).toISOString(),
      },
      ip_address: '192.168.1.100',
    },
    created_at: new Date(Date.now() - 180000).toISOString(),
    updated_at: new Date(Date.now() - 180000).toISOString(),
    event: 'created',
  },
  {
    id: '7',
    log_name: 'auth',
    description: 'failed login attempt',
    subject_type: 'App\\Models\\User',
    subject_id: '2',
    causer_type: null,
    causer_id: null,
    properties: {
      ip_address: '192.168.1.200',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1)',
      reason: 'Invalid credentials',
      attempt: 2,
    },
    created_at: new Date(Date.now() - 240000).toISOString(),
    updated_at: new Date(Date.now() - 240000).toISOString(),
    event: 'login_failed',
  },
  {
    id: '8',
    log_name: 'media',
    description: 'uploaded',
    subject_type: 'App\\Models\\Media',
    subject_id: '56',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      attributes: {
        filename: 'stacks-architecture.png',
        size: '1.2MB',
        mime_type: 'image/png',
        path: '/storage/uploads/stacks-architecture.png',
      },
      ip_address: '192.168.1.1',
    },
    created_at: new Date(Date.now() - 300000).toISOString(),
    updated_at: new Date(Date.now() - 300000).toISOString(),
    event: 'uploaded',
  },
  {
    id: '9',
    log_name: 'posts',
    description: 'deleted',
    subject_type: 'App\\Models\\Post',
    subject_id: '41',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      old: {
        title: 'Deprecated Feature Guide',
        slug: 'deprecated-feature-guide',
        content: 'This guide covers features that are now deprecated...',
        published: true,
      },
      ip_address: '192.168.1.1',
    },
    created_at: new Date(Date.now() - 360000).toISOString(),
    updated_at: new Date(Date.now() - 360000).toISOString(),
    event: 'deleted',
  },
  {
    id: '10',
    log_name: 'default',
    description: 'system backup completed',
    subject_type: 'App\\Services\\Backup',
    subject_id: '5',
    causer_type: 'App\\Models\\User',
    causer_id: '4',
    properties: {
      attributes: {
        size: '256MB',
        files_count: 1250,
        destination: 's3://backups/daily/2023-05-15.zip',
        duration: '45s',
      },
    },
    created_at: new Date(Date.now() - 420000).toISOString(),
    updated_at: new Date(Date.now() - 420000).toISOString(),
    event: 'completed',
  },
  {
    id: '11',
    log_name: 'deployment',
    description: 'Production deployment successful',
    subject_type: 'App\\Services\\Deployment',
    subject_id: '123',
    causer_type: 'App\\Models\\User',
    causer_id: '1',
    properties: {
      environment: 'production',
      branch: 'main',
      commit: '7829abc',
      duration: '45s',
      status: 'success',
    },
    created_at: new Date(Date.now() - 10 * 60000).toISOString(), // 10 minutes ago
    updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
    event: 'completed',
  },
  {
    id: '12',
    log_name: 'blog',
    description: 'New blog post published',
    subject_type: 'App\\Models\\Post',
    subject_id: '45',
    causer_type: 'App\\Models\\User',
    causer_id: '3',
    properties: {
      attributes: {
        title: 'Getting Started with Activity Logs',
        slug: 'getting-started-with-activity-logs',
        status: 'published',
        created_at: new Date(Date.now() - 60 * 60000).toISOString(), // 1 hour ago
      },
      status: 'success',
    },
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60000).toISOString(),
    event: 'published',
  },
  {
    id: '13',
    log_name: 'server',
    description: 'Server maintenance completed',
    subject_type: 'App\\Services\\Server',
    subject_id: '2',
    causer_type: 'App\\Models\\User',
    causer_id: '4',
    properties: {
      server: 'app-server-01',
      maintenance_type: 'scheduled',
      duration: '120m',
      status: 'success',
    },
    created_at: new Date(Date.now() - 3 * 60 * 60000).toISOString(), // 3 hours ago
    updated_at: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    event: 'maintained',
  },
  {
    id: '14',
    log_name: 'default',
    description: 'API rate limit exceeded',
    subject_type: 'App\\Services\\Api',
    subject_id: '1',
    causer_type: null,
    causer_id: null,
    properties: {
      endpoint: '/api/v1/users',
      limit: 1000,
      period: '1 hour',
      ip: '192.168.1.50',
      status: 'error',
    },
    created_at: new Date(Date.now() - 5 * 60 * 60000).toISOString(), // 5 hours ago
    updated_at: new Date(Date.now() - 5 * 60 * 60000).toISOString(),
    event: 'exceeded',
  },
  {
    id: '15',
    log_name: 'commerce',
    description: 'New order received',
    subject_type: 'App\\Models\\Order',
    subject_id: '1001',
    causer_type: 'App\\Models\\User',
    causer_id: '2',
    properties: {
      attributes: {
        order_number: 'ORD-1001',
        total: '$129.99',
        items: 3,
        status: 'pending',
        created_at: new Date(Date.now() - 12 * 60 * 60000).toISOString(), // 12 hours ago
      },
      status: 'success',
    },
    created_at: new Date(Date.now() - 12 * 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 60000).toISOString(),
    event: 'created',
  },
]

// Process logs to add computed properties
const processLogs = (logs: ActivityLog[]) => {
  return logs.map(log => {
    // Find causer (user who performed the action)
    const causer = log.causer_id ? users.find(u => u.id === log.causer_id) : undefined

    // Get subject name based on type and properties
    let subject_name = ''
    if (log.subject_type === 'App\\Models\\User' && log.properties?.attributes?.name) {
      subject_name = log.properties.attributes.name
    } else if (log.subject_type === 'App\\Models\\Post' && log.properties?.attributes?.title) {
      subject_name = log.properties.attributes.title
    } else if (log.subject_type === 'App\\Models\\Media' && log.properties?.attributes?.filename) {
      subject_name = log.properties.attributes.filename
    } else if (log.subject_type === 'App\\Services\\Backup') {
      subject_name = 'System Backup'
    } else if (log.subject_type === 'App\\Services\\Deployment') {
      subject_name = `Deployment to ${log.properties?.environment || 'unknown'}`
    } else if (log.subject_type === 'App\\Services\\Server') {
      subject_name = log.properties?.server || 'Server'
    } else if (log.subject_type === 'App\\Services\\Api') {
      subject_name = log.properties?.endpoint || 'API'
    } else if (log.subject_type === 'App\\Models\\Order' && log.properties?.attributes?.order_number) {
      subject_name = log.properties.attributes.order_number
    } else {
      // Get the last part of the subject type as a fallback
      const parts = log.subject_type.split('\\')
      subject_name = `${parts[parts.length - 1]} #${log.subject_id}`
    }

    // Determine icon and color based on event and status
    let icon = 'i-hugeicons-information-circle'
    let color = 'text-blue-500'

    // Check if there's a status in properties
    const status = log.properties?.status

    if (status === 'error') {
      icon = 'i-hugeicons-alert-02'
      color = 'text-red-500'
    } else if (status === 'warning') {
      icon = 'i-hugeicons-alert-02'
      color = 'text-amber-500'
    } else {
      // If no status, use event to determine icon/color
      switch (log.event) {
        case 'created':
          icon = 'i-hugeicons-plus-sign-circle'
          color = 'text-green-500'
          break
        case 'updated':
          icon = 'i-hugeicons-edit-01'
          color = 'text-blue-500'
          break
        case 'deleted':
          icon = 'i-hugeicons-waste'
          color = 'text-red-500'
          break
        case 'login':
          icon = 'i-hugeicons-login-03'
          color = 'text-indigo-500'
          break
        case 'login_failed':
          icon = 'i-hugeicons-login-03'
          color = 'text-amber-500'
          break
        case 'uploaded':
          icon = 'i-hugeicons-upload-03'
          color = 'text-purple-500'
          break
        case 'completed':
          icon = 'i-hugeicons-checkmark-circle-02'
          color = 'text-green-500'
          break
        case 'published':
          icon = 'i-hugeicons-book-open-01'
          color = 'text-violet-500'
          break
        case 'maintained':
          icon = 'i-hugeicons-settings-01'
          color = 'text-cyan-500'
          break
        case 'exceeded':
          icon = 'i-hugeicons-alert-02'
          color = 'text-red-500'
          break
        default:
          icon = 'i-hugeicons-information-circle'
          color = 'text-gray-500'
      }
    }

    return {
      ...log,
      causer,
      subject_name,
      icon,
      color
    }
  })
}

const filteredLogs = computed(() => {
  return activityLogs.value.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      log.subject_name?.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      log.causer?.name.toLowerCase().includes(searchTerm.value.toLowerCase());

    const matchesLogName = logNameFilter.value === 'all' || log.log_name === logNameFilter.value;

    const matchesEvent = eventFilter.value === 'all' || log.event === eventFilter.value;

    const matchesSubjectType = subjectTypeFilter.value === 'all' || log.subject_type === subjectTypeFilter.value;

    return matchesSearch && matchesLogName && matchesEvent && matchesSubjectType;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
});

// Add pagination computed properties
const paginatedLogs = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  totalItems.value = filteredLogs.value.length;
  return filteredLogs.value.slice(startIndex, endIndex);
});

const totalPages = computed(() => {
  return Math.ceil(totalItems.value / itemsPerPage.value);
});

// Add pagination methods
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const resetFilters = () => {
  searchTerm.value = '';
  logNameFilter.value = 'all';
  eventFilter.value = 'all';
  subjectTypeFilter.value = 'all';
  currentPage.value = 1;
};

// Helper functions for UI
const getLogNameClasses = (logName: string): { bg: string, text: string, ring: string } => {
  const log = logNames.find(l => l.id === logName);
  if (log) {
    switch (log.color) {
      case 'blue':
        return { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-500' }
      case 'indigo':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', ring: 'ring-indigo-500' }
      case 'purple':
        return { bg: 'bg-purple-100', text: 'text-purple-800', ring: 'ring-purple-500' }
      case 'pink':
        return { bg: 'bg-pink-100', text: 'text-pink-800', ring: 'ring-pink-500' }
      case 'rose':
        return { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-500' }
      case 'amber':
        return { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-500' }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', ring: 'ring-gray-500' }
    }
  }
  return { bg: 'bg-gray-100', text: 'text-gray-800', ring: 'ring-gray-500' }
}

const getLogRowClass = (event: string) => {
  switch (event) {
    case 'deleted':
      return 'bg-red-50 bg-opacity-50'
    case 'created':
      return 'bg-green-50 bg-opacity-50'
    case 'login_failed':
      return 'bg-amber-50 bg-opacity-50'
    case 'uploaded':
      return 'bg-purple-50 bg-opacity-50'
    default:
      return ''
  }
}

// These functions are no longer needed as we're using the icon and color directly from the processed log
// But we'll keep them as empty functions to avoid template errors
const getLogIcon = (icon: string | undefined) => icon || 'i-hugeicons-information-circle'
const getLogIconColor = (color: string | undefined) => color || 'text-gray-500'

let refreshInterval: number | undefined

onMounted(() => {
  activityLogs.value = processLogs(sampleActivityLogs)
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

const startAutoRefresh = () => {
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(() => {
      // In reality, this would fetch new logs
      // fetchNewLogs()
    }, 2000)
  }
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = undefined
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
    x: {
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
    },
  },
}

// Generate mock activity volume data
const getLogVolumeData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'Created',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 40) + 20),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'Updated',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100) + 50),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Deleted',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 20)),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
      {
        label: 'Login',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 60) + 30),
        borderColor: 'rgb(139, 92, 246)', // Purple
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Failed Login',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 15) + 5),
        borderColor: 'rgb(245, 158, 11)', // Amber
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
      }
    ],
  }
}

const logVolumeData = ref(getLogVolumeData())

// Add timeRange ref
const timeRange = ref<'day' | 'week' | 'month' | 'year'>('day')

// Watch for time range changes
watch(timeRange, async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  logVolumeData.value = getLogVolumeData()
  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Log Volume Chart -->
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Activity Volume</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Distribution of activity types over time</p>
            </div>
            <select
              v-model="timeRange"
              class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div class="h-[300px] relative">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
            <Line :data="logVolumeData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <div class="mt-8 sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
            Activity Log
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
            A comprehensive log of all activities in your application. Monitor user actions and system events.
          </p>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="mt-8 flow-root">
        <div class="mb-6 space-y-4">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-[200px]">
              <input
                v-model="searchTerm"
                type="text"
                placeholder="Search activities..."
                class="w-full px-4 py-2 border rounded-lg dark:bg-blue-gray-700 dark:border-blue-gray-600 dark:text-gray-100"
              >
            </div>

            <select
              v-model="logNameFilter"
              class="px-4 py-2 border rounded-lg bg-white min-w-[140px] dark:bg-blue-gray-700 dark:border-blue-gray-600 dark:text-gray-100"
            >
              <option value="all">All Logs</option>
              <option v-for="log in logNames" :key="log.id" :value="log.id">{{ log.name }}</option>
            </select>

            <select
              v-model="eventFilter"
              class="px-4 py-2 border rounded-lg bg-white min-w-[140px] dark:bg-blue-gray-700 dark:border-blue-gray-600 dark:text-gray-100"
            >
              <option value="all">All Events</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
              <option value="login">Login</option>
              <option value="login_failed">Failed Login</option>
              <option value="uploaded">Uploaded</option>
              <option value="completed">Completed</option>
              <option value="published">Published</option>
              <option value="maintained">Maintained</option>
              <option value="exceeded">Rate Limited</option>
            </select>

            <select
              v-model="subjectTypeFilter"
              class="px-4 py-2 border rounded-lg bg-white min-w-[140px] dark:bg-blue-gray-700 dark:border-blue-gray-600 dark:text-gray-100"
            >
              <option value="all">All Models</option>
              <option v-for="subject in subjectTypes" :key="subject.type" :value="subject.type">{{ subject.name }}</option>
            </select>

            <button
              class="flex items-center gap-2 px-4 py-2 rounded-lg"
              :class="autoRefresh ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
              @click="toggleAutoRefresh"
            >
              <i
                class="i-hugeicons-refresh h-4 w-4"
                :class="{ 'animate-spin': autoRefresh }"
                aria-hidden="true"
              />
              {{ autoRefresh ? 'Auto-refreshing' : 'Auto-refresh' }}
            </button>

            <button
              v-if="searchTerm || logNameFilter !== 'all' || eventFilter !== 'all' || subjectTypeFilter !== 'all'"
              class="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              @click="resetFilters"
            >
              <i class="i-hugeicons-cancel-01 h-4 w-4" aria-hidden="true" />
              Reset Filters
            </button>
          </div>
        </div>

        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-800">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Time</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Caused By</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Event</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Log</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Subject</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Details</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-700 dark:divide-gray-600">
                  <tr
                    v-for="log in paginatedLogs"
                    :key="log.id"
                    :class="[getLogRowClass(log.event), 'hover:bg-gray-50 dark:hover:bg-blue-gray-600 cursor-pointer']"
                    @click="selectedLog = log"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900 dark:text-gray-200">
                        <i
                          class="i-hugeicons-clock-01 h-4 w-4 mr-2 text-gray-400 dark:text-gray-500"
                          aria-hidden="true"
                        />
                        {{ new Date(log.created_at).toLocaleTimeString() }}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ new Date(log.created_at).toLocaleDateString() }}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div v-if="log.causer" class="flex-shrink-0 h-8 w-8">
                          <img
                            v-if="log.causer.avatar"
                            class="h-8 w-8 rounded-full"
                            :src="log.causer.avatar"
                            alt=""
                          />
                          <div
                            v-else
                            class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300"
                          >
                            {{ log.causer.name.charAt(0) }}
                          </div>
                        </div>
                        <div v-if="log.causer" class="ml-3">
                          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">
                            {{ log.causer.name }}
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400">
                            {{ log.causer.email }}
                          </div>
                        </div>
                        <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                          System
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <i
                          :class="[log.icon, log.color, 'h-5 w-5 mr-2']"
                          aria-hidden="true"
                        />
                        <span class="text-sm text-gray-900 dark:text-gray-200 capitalize">{{ log.event }}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="[getLogNameClasses(log.log_name).bg, getLogNameClasses(log.log_name).text]"
                      >
                        {{ logNames.find(l => l.id === log.log_name)?.name || log.log_name }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900 dark:text-gray-200">{{ log.subject_name }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ log.description }}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <button class="text-gray-400 hover:text-blue-500 transition-colors duration-150 dark:text-gray-500 dark:hover:text-blue-400">
                        <i class="i-hugeicons-view h-5 w-5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Pagination Controls -->
        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center">
            <span class="text-sm text-gray-700 dark:text-gray-400">
              Showing <span class="font-medium">{{ paginatedLogs.length }}</span> of <span class="font-medium">{{ totalItems }}</span> results
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <select
              v-model="itemsPerPage"
              class="px-2 py-1 text-sm border rounded-md dark:bg-blue-gray-700 dark:border-blue-gray-600 dark:text-gray-200"
              @change="currentPage = 1"
            >
              <option :value="10">10 per page</option>
              <option :value="25">25 per page</option>
              <option :value="50">50 per page</option>
              <option :value="100">100 per page</option>
            </select>

            <div class="flex items-center space-x-1">
              <button
                @click="prevPage"
                :disabled="currentPage === 1"
                class="px-2 py-1 text-sm border rounded-md dark:border-blue-gray-600 dark:text-gray-300"
                :class="currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-blue-gray-600'"
              >
                <i class="i-hugeicons-arrow-left-01 h-4 w-4" aria-hidden="true" />
              </button>

              <button
                v-for="page in Math.min(5, totalPages)"
                :key="page"
                @click="goToPage(page)"
                class="px-3 py-1 text-sm border rounded-md dark:border-blue-gray-600"
                :class="currentPage === page ? 'bg-blue-600 text-white dark:bg-blue-700' : 'hover:bg-gray-100 dark:hover:bg-blue-gray-600 dark:text-gray-300'"
              >
                {{ page }}
              </button>

              <span v-if="totalPages > 5" class="px-2 dark:text-gray-400">...</span>

              <button
                v-if="totalPages > 5"
                @click="goToPage(totalPages)"
                class="px-3 py-1 text-sm border rounded-md dark:border-blue-gray-600 dark:text-gray-300"
                :class="currentPage === totalPages ? 'bg-blue-600 text-white dark:bg-blue-700' : 'hover:bg-gray-100 dark:hover:bg-blue-gray-600'"
              >
                {{ totalPages }}
              </button>

              <button
                @click="nextPage"
                :disabled="currentPage === totalPages || totalPages === 0"
                class="px-2 py-1 text-sm border rounded-md dark:border-blue-gray-600 dark:text-gray-300"
                :class="currentPage === totalPages || totalPages === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-blue-gray-600'"
              >
                <i class="i-hugeicons-arrow-right-01 h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <!-- Activity Detail Modal -->
        <Teleport to="body">
          <div
            v-if="selectedLog"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            @click.self="selectedLog = null"
          >
            <div class="bg-white dark:bg-blue-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold dark:text-white">Activity Details</h3>
                <button
                  @click="selectedLog = null"
                  class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <i
                    class="i-hugeicons-cancel-01 h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div class="space-y-6" v-if="selectedLog">
                <!-- Header with user info -->
                <div class="flex items-start">
                  <div v-if="selectedLog.causer" class="flex-shrink-0 h-10 w-10">
                    <img
                      v-if="selectedLog.causer.avatar"
                      class="h-10 w-10 rounded-full"
                      :src="selectedLog.causer.avatar"
                      alt=""
                    />
                    <div
                      v-else
                      class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg"
                    >
                      {{ selectedLog.causer.name.charAt(0) }}
                    </div>
                  </div>
                  <div class="ml-4 flex-1">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-lg font-medium text-gray-900 dark:text-white">
                          {{ selectedLog.causer ? selectedLog.causer.name : 'System' }}
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ selectedLog.causer ? selectedLog.causer.email : '' }}
                        </p>
                      </div>
                      <div class="flex items-center">
                        <i
                          :class="[selectedLog.icon, selectedLog.color, 'h-5 w-5 mr-2']"
                          aria-hidden="true"
                        />
                        <span class="text-sm font-medium capitalize">{{ selectedLog.event }}</span>
                      </div>
                    </div>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      <span class="font-medium capitalize">{{ selectedLog.description }}</span>
                      <span class="text-gray-500 dark:text-gray-400"> - {{ new Date(selectedLog.created_at).toLocaleString() }}</span>
                    </p>
                  </div>
                </div>

                <!-- Activity details -->
                <div class="bg-gray-50 dark:bg-blue-gray-700 p-4 rounded-lg">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Log Channel</label>
                      <div class="mt-1">
                        <span
                          class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                          :class="[getLogNameClasses(selectedLog.log_name).bg, getLogNameClasses(selectedLog.log_name).text]"
                        >
                          {{ logNames.find(l => l.id === selectedLog.log_name)?.name || selectedLog.log_name }}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject Type</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-gray-200">
                        {{ subjectTypes.find(s => s.type === selectedLog.subject_type)?.name || selectedLog.subject_type }}
                      </p>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-gray-200">{{ selectedLog.subject_name }}</p>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject ID</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-gray-200 font-mono">{{ selectedLog.subject_id }}</p>
                    </div>
                  </div>
                </div>

                <!-- Changed attributes -->
                <div v-if="selectedLog.properties?.attributes || selectedLog.properties?.old">
                  <h4 class="text-base font-medium text-gray-900 dark:text-white mb-2">Changed Attributes</h4>

                  <div class="bg-gray-50 dark:bg-blue-gray-700 rounded-lg overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-blue-gray-600">
                      <div class="grid grid-cols-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <div>Attribute</div>
                        <div v-if="selectedLog.properties?.old">Old Value</div>
                        <div>New Value</div>
                      </div>
                    </div>

                    <div class="divide-y divide-gray-200 dark:divide-gray-600">
                      <template v-if="selectedLog.properties?.attributes">
                        <div
                          v-for="(value, key) in selectedLog.properties.attributes"
                          :key="key"
                          class="px-4 py-3 grid grid-cols-3 text-sm"
                          v-show="key !== 'created_at' && key !== 'updated_at'"
                        >
                          <div class="font-medium text-gray-900 dark:text-white">{{ key }}</div>
                          <div v-if="selectedLog.properties?.old" class="text-gray-700 dark:text-gray-300">
                            {{ selectedLog.properties.old[key] || '-' }}
                          </div>
                          <div class="text-gray-900 dark:text-white">{{ value }}</div>
                        </div>
                      </template>

                      <template v-else-if="selectedLog.properties?.old">
                        <div
                          v-for="(value, key) in selectedLog.properties.old"
                          :key="key"
                          class="px-4 py-3 grid grid-cols-3 text-sm"
                          v-show="key !== 'created_at' && key !== 'updated_at'"
                        >
                          <div class="font-medium text-gray-900 dark:text-white">{{ key }}</div>
                          <div class="text-gray-700 dark:text-gray-300">{{ value }}</div>
                          <div class="text-gray-900 dark:text-white">-</div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Additional metadata -->
                <div v-if="selectedLog.properties && Object.keys(selectedLog.properties).some(key => key !== 'attributes' && key !== 'old')">
                  <h4 class="text-base font-medium text-gray-900 dark:text-white mb-2">Additional Metadata</h4>
                  <div class="bg-gray-50 dark:bg-blue-gray-700 p-4 rounded-lg">
                    <div
                      v-for="(value, key) in selectedLog.properties"
                      :key="key"
                      v-show="key !== 'attributes' && key !== 'old'"
                      class="mb-3 last:mb-0"
                    >
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{{ key }}</label>
                      <div class="mt-1">
                        <span v-if="typeof value === 'string'" class="text-sm text-gray-900 dark:text-gray-200">
                          {{ value }}
                        </span>
                        <pre v-else class="text-sm text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-blue-gray-600 p-2 rounded overflow-x-auto">{{ JSON.stringify(value, null, 2) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>
